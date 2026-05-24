import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const STATUS = new Set(['Created', 'Assigned', 'Running', 'Done', 'Failed', 'Cancelled']);

export class TaskStore {
  constructor({ dataDir = path.resolve('data') } = {}) {
    this.dataDir = dataDir;
    this.tasksFile = path.join(dataDir, 'tasks.json');
    this.projectsFile = path.join(dataDir, 'projects.json');
    this.runsDir = path.join(dataDir, 'runs');
  }

  async init() {
    await mkdir(this.runsDir, { recursive: true });
    
    // Initialize projects.json if not present
    let projects = [];
    try {
      const rawProjects = await readFile(this.projectsFile, 'utf8');
      projects = JSON.parse(rawProjects);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#writeProjects([]);
    }

    // Initialize tasks.json if not present, or migrate tasks
    let tasks = [];
    let tasksFileExists = true;
    try {
      const rawTasks = await readFile(this.tasksFile, 'utf8');
      tasks = JSON.parse(rawTasks);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      tasksFileExists = false;
      await this.#writeTasks([]);
    }

    // Migration and default project generation
    if (tasksFileExists) {
      const legacyTasks = tasks.filter(task => !task.projectId);
      const workspaceByProjectId = new Map();
      for (const task of tasks) {
        if (task.projectId && task.workspacePath?.trim() && !workspaceByProjectId.has(task.projectId)) {
          workspaceByProjectId.set(task.projectId, task.workspacePath.trim());
        }
      }
      let projectsMigrated = false;

      if (legacyTasks.length > 0) {
        // Ensure default project exists
        let defaultProj = projects.find(p => p.id === 'default-project');
        if (!defaultProj) {
          defaultProj = {
            id: 'default-project',
            name: 'Default Project',
            description: 'Default project for migrated tasks',
            workspacePath: legacyTasks.find(task => task.workspacePath?.trim())?.workspacePath.trim() ?? ''
          };
          projects.push(defaultProj);
          projectsMigrated = true;
        } else if (!defaultProj.workspacePath?.trim()) {
          const legacyWorkspacePath = legacyTasks.find(task => task.workspacePath?.trim())?.workspacePath.trim();
          if (legacyWorkspacePath) {
            defaultProj.workspacePath = legacyWorkspacePath;
            projectsMigrated = true;
          }
        }

        // Migrate legacy tasks
        let migrated = false;
        for (const task of tasks) {
          if (!task.projectId) {
            task.projectId = 'default-project';
            migrated = true;
          }
          if (!task.messages) {
            task.messages = [];
            migrated = true;
          }
        }
        if (migrated) {
          await this.#writeTasks(tasks);
        }
      }

      for (const project of projects) {
        const workspacePath = workspaceByProjectId.get(project.id);
        if (!project.workspacePath?.trim() && workspacePath) {
          project.workspacePath = workspacePath;
          projectsMigrated = true;
        } else if (project.workspacePath?.trim() && project.workspacePath !== project.workspacePath.trim()) {
          project.workspacePath = project.workspacePath.trim();
          projectsMigrated = true;
        }
      }
      if (projectsMigrated) {
        await this.#writeProjects(projects);
      }
    }
  }

  async listProjects() {
    return await this.#readProjects();
  }

  async getProject(id) {
    const projects = await this.#readProjects();
    return projects.find((project) => project.id === id) ?? null;
  }

  async createProject({ name, description = '', workspacePath }) {
    if (!name?.trim()) {
      throw new Error('Project name is required');
    }
    if (!workspacePath?.trim()) {
      throw new Error('Workspace path is required');
    }
    const project = {
      id: randomUUID(),
      name: name.trim(),
      description: description.trim(),
      workspacePath: workspacePath.trim()
    };
    const projects = await this.#readProjects();
    projects.push(project);
    await this.#writeProjects(projects);
    return project;
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
    if (!input.projectId) {
      throw new Error('projectId is required');
    }
    const projects = await this.#readProjects();
    const projectExists = projects.some(p => p.id === input.projectId);
    if (!projectExists) {
      throw new Error(`Project with ID ${input.projectId} does not exist`);
    }

    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
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
      error: '',
      tokenUsage: null,
      terminalEvents: [],
      messages: []
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

  async appendTerminalEvent(id, event) {
    const tasks = await this.#readTasks();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return null;

    tasks[index] = {
      ...tasks[index],
      terminalEvents: [...(tasks[index].terminalEvents || []), event],
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

  async #readProjects() {
    await this.init();
    const raw = await readFile(this.projectsFile, 'utf8');
    return JSON.parse(raw);
  }

  async #writeProjects(projects) {
    await mkdir(this.dataDir, { recursive: true });
    const tmpFile = `${this.projectsFile}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
    await rename(tmpFile, this.projectsFile);
  }
}
