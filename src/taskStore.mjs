import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const STATUS = new Set(['Created', 'Assigned', 'Running', 'Done', 'Failed', 'Cancelled']);

export class TaskStore {
  constructor({ dataDir = path.resolve('data') } = {}) {
    this.dataDir = dataDir;
    this.tasksFile = path.join(dataDir, 'tasks.json');
    this.runsDir = path.join(dataDir, 'runs');
  }

  async init() {
    await mkdir(this.runsDir, { recursive: true });
    try {
      await readFile(this.tasksFile, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#writeTasks([]);
    }
  }

  async listTasks() {
    const tasks = await this.#readTasks();
    return tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async getTask(id) {
    const tasks = await this.#readTasks();
    return tasks.find((task) => task.id === id) ?? null;
  }

  async createTask(input) {
    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description.trim(),
      workspacePath: input.workspacePath.trim(),
      subagent: input.subagent,
      notes: input.notes?.trim() ?? '',
      status: 'Assigned',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      sessionRef: null,
      processRef: null,
      runArtifactPath: null,
      output: '',
      log: '',
      error: ''
    };
    const tasks = await this.#readTasks();
    tasks.push(task);
    await this.#writeTasks(tasks);
    return task;
  }

  async updateTask(id, patch) {
    const tasks = await this.#readTasks();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;

    const status = patch.status ?? tasks[index].status;
    if (!STATUS.has(status)) {
      throw new Error(`Unsupported task status: ${status}`);
    }

    tasks[index] = {
      ...tasks[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    await this.#writeTasks(tasks);
    return tasks[index];
  }

  async createRunArtifact(taskId, sessionRef) {
    const runDir = path.join(this.runsDir, `${taskId}-${sessionRef}`);
    await mkdir(runDir, { recursive: true });
    return runDir;
  }

  async writeRunFile(runDir, fileName, content) {
    await writeFile(path.join(runDir, fileName), content, 'utf8');
  }

  async #readTasks() {
    await this.init();
    const raw = await readFile(this.tasksFile, 'utf8');
    return JSON.parse(raw);
  }

  async #writeTasks(tasks) {
    await mkdir(this.dataDir, { recursive: true });
    const tmpFile = `${this.tasksFile}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
    await rename(tmpFile, this.tasksFile);
  }
}
