import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { EventEmitter } from 'node:events';
import { normalizeStoredTask } from './taskCockpit.mjs';

const STATUS = new Set(['Created', 'Assigned', 'Running', 'Done', 'Failed', 'Cancelled']);

export class TaskStore extends EventEmitter {
  constructor({ dataDir = path.resolve('data') } = {}) {
    super();
    this.dataDir = dataDir;
    this.dbFile = path.join(dataDir, 'codex-tasks.sqlite');
    this.runsDir = path.join(dataDir, 'runs');
    this.db = null;
  }

  async init() {
    await mkdir(this.runsDir, { recursive: true });
    await mkdir(this.dataDir, { recursive: true });

    if (!this.db) {
      this.db = new Database(this.dbFile);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          workspacePath TEXT
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          subagent TEXT,
          notes TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          startedAt TEXT,
          finishedAt TEXT,
          sessionRef TEXT,
          processRef TEXT,
          currentRunRef TEXT,
          runArtifactPath TEXT,
          output TEXT,
          log TEXT,
          error TEXT,
          tokenUsage TEXT,
          messages TEXT,
          needsInput TEXT,
          verificationState TEXT,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          taskId TEXT NOT NULL,
          event TEXT NOT NULL,
          FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);

      await this.#migrateFromJSON();
    }
  }

  async #migrateFromJSON() {
    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const projectsFile = path.join(this.dataDir, 'projects.json');
    
    const { count } = this.db.prepare('SELECT count(*) as count FROM projects').get();
    if (count > 0) return;

    let projects = [];
    try {
      const rawProjects = await readFile(projectsFile, 'utf8');
      projects = JSON.parse(rawProjects);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    let tasks = [];
    try {
      const rawTasks = await readFile(tasksFile, 'utf8');
      tasks = JSON.parse(rawTasks);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    if (projects.length === 0 && tasks.length === 0) return;

    const insertProject = this.db.prepare(`
      INSERT INTO projects (id, name, description, workspacePath)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertTask = this.db.prepare(`
      INSERT INTO tasks (
        id, projectId, title, description, subagent, notes, status,
        createdAt, updatedAt, startedAt, finishedAt, sessionRef, processRef, currentRunRef, runArtifactPath,
        output, log, error, tokenUsage, messages, needsInput, verificationState
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const insertEvent = this.db.prepare(`
      INSERT INTO task_events (taskId, event) VALUES (?, ?)
    `);

    const migrate = this.db.transaction(() => {
      const legacyTasks = tasks.filter(task => !task.projectId);
      if (legacyTasks.length > 0) {
        let defaultProj = projects.find(p => p.id === 'default-project');
        if (!defaultProj) {
          defaultProj = {
            id: 'default-project',
            name: 'Default Project',
            description: 'Default project for migrated tasks',
            workspacePath: legacyTasks.find(t => t.workspacePath?.trim())?.workspacePath.trim() ?? ''
          };
          projects.push(defaultProj);
        }
      }

      for (const project of projects) {
        insertProject.run(
          project.id,
          project.name,
          project.description || '',
          project.workspacePath || ''
        );
      }

      for (let task of tasks) {
        if (!task.projectId) task.projectId = 'default-project';
        if (!task.messages) task.messages = [];
        
        task = normalizeStoredTask(task);

        insertTask.run(
          task.id,
          task.projectId,
          task.title,
          task.description || '',
          task.subagent || '',
          task.notes || '',
          task.status,
          task.createdAt,
          task.updatedAt,
          task.startedAt,
          task.finishedAt,
          task.sessionRef,
          task.processRef,
          task.currentRunRef,
          task.runArtifactPath,
          task.output || '',
          task.log || '',
          task.error || '',
          task.tokenUsage ? JSON.stringify(task.tokenUsage) : null,
          JSON.stringify(task.messages || []),
          JSON.stringify(task.needsInput || { active: false, reason: 'manual', message: '', createdAt: null }),
          task.verificationState || 'unknown'
        );

        if (task.terminalEvents && task.terminalEvents.length > 0) {
          for (const ev of task.terminalEvents) {
            insertEvent.run(task.id, JSON.stringify(ev));
          }
        }
      }
    });

    migrate();

    try {
      await rename(projectsFile, projectsFile + '.bak');
      await rename(tasksFile, tasksFile + '.bak');
    } catch (e) {
      // Ignore
    }
  }

  async listProjects() {
    if (!this.db) await this.init();
    return this.db.prepare('SELECT * FROM projects').all();
  }

  async getProject(id) {
    if (!this.db) await this.init();
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null;
  }

  async createProject({ name, description = '', workspacePath }) {
    if (!name?.trim()) throw new Error('Project name is required');
    if (!workspacePath?.trim()) throw new Error('Workspace path is required');
    
    if (!this.db) await this.init();
    const project = {
      id: randomUUID(),
      name: name.trim(),
      description: description.trim(),
      workspacePath: workspacePath.trim()
    };
    
    this.db.prepare(`
      INSERT INTO projects (id, name, description, workspacePath)
      VALUES (@id, @name, @description, @workspacePath)
    `).run(project);
    
    return project;
  }

  async listTasks() {
    if (!this.db) await this.init();
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY datetime(updatedAt) DESC').all();
    return rows.map(row => {
      const task = this.#parseTaskRow(row);
      const events = this.db.prepare('SELECT event FROM task_events WHERE taskId = ? ORDER BY id ASC').all(task.id);
      task.terminalEvents = events.map(e => JSON.parse(e.event));
      return task;
    });
  }

  async getTask(id) {
    if (!this.db) await this.init();
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!row) return null;
    
    const task = this.#parseTaskRow(row);
    const events = this.db.prepare('SELECT event FROM task_events WHERE taskId = ? ORDER BY id ASC').all(id);
    task.terminalEvents = events.map(e => JSON.parse(e.event));
    
    return task;
  }

  async createTask(input) {
    if (!input.projectId) throw new Error('projectId is required');
    if (!this.db) await this.init();

    const projectExists = this.db.prepare('SELECT 1 FROM projects WHERE id = ?').get(input.projectId);
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
      currentRunRef: null,
      runArtifactPath: null,
      output: '',
      log: '',
      error: '',
      tokenUsage: null,
      terminalEvents: [],
      messages: [],
      needsInput: {
        active: false,
        reason: 'manual',
        message: '',
        createdAt: null
      },
      verificationState: 'unknown'
    };

    this.db.prepare(`
      INSERT INTO tasks (
        id, projectId, title, description, subagent, notes, status,
        createdAt, updatedAt, startedAt, finishedAt, sessionRef, processRef, currentRunRef, runArtifactPath,
        output, log, error, tokenUsage, messages, needsInput, verificationState
      ) VALUES (
        @id, @projectId, @title, @description, @subagent, @notes, @status,
        @createdAt, @updatedAt, @startedAt, @finishedAt, @sessionRef, @processRef, @currentRunRef, @runArtifactPath,
        @output, @log, @error, @tokenUsage, @messages, @needsInput, @verificationState
      )
    `).run({
      ...task,
      tokenUsage: null,
      messages: JSON.stringify(task.messages),
      needsInput: JSON.stringify(task.needsInput)
    });

    this.emit('task-created', task);
    return task;
  }

  async updateTask(id, patch) {
    if (!this.db) await this.init();

    const updatedTask = this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!row) return null;

      const currentTask = this.#parseTaskRow(row);
      
      const events = this.db.prepare('SELECT event FROM task_events WHERE taskId = ? ORDER BY id ASC').all(id);
      currentTask.terminalEvents = events.map(e => JSON.parse(e.event));

      const status = patch.status ?? currentTask.status;
      if (!STATUS.has(status)) {
        throw new Error(`Unsupported task status: ${status}`);
      }

      const mergedTask = normalizeStoredTask({
        ...currentTask,
        ...patch,
        updatedAt: new Date().toISOString()
      });

      this.db.prepare(`
        UPDATE tasks SET
          status = @status,
          updatedAt = @updatedAt,
          startedAt = @startedAt,
          finishedAt = @finishedAt,
          sessionRef = @sessionRef,
          processRef = @processRef,
          currentRunRef = @currentRunRef,
          runArtifactPath = @runArtifactPath,
          output = @output,
          log = @log,
          error = @error,
          tokenUsage = @tokenUsage,
          messages = @messages,
          needsInput = @needsInput,
          verificationState = @verificationState
        WHERE id = @id
      `).run({
        ...mergedTask,
        tokenUsage: mergedTask.tokenUsage ? JSON.stringify(mergedTask.tokenUsage) : null,
        messages: JSON.stringify(mergedTask.messages),
        needsInput: JSON.stringify(mergedTask.needsInput)
      });
      
      return mergedTask;
    })();

    if (updatedTask) {
      this.emit('task-updated', updatedTask);
    }
    return updatedTask;
  }

  async deleteTask(id) {
    if (!this.db) await this.init();
    
    const task = this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!row) return null;
      const t = this.#parseTaskRow(row);
      if (t.status === 'Running') {
        throw new Error('Running tasks cannot be deleted');
      }

      this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
      return t;
    })();

    if (task) {
      this.emit('task-deleted', task);
    }
    return task;
  }

  async deleteProject(id) {
    if (!this.db) await this.init();

    const result = this.db.transaction(() => {
      const project = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      if (!project) return null;

      const taskRows = this.db.prepare('SELECT * FROM tasks WHERE projectId = ?').all(id);
      const tasks = taskRows.map(this.#parseTaskRow.bind(this));
      if (tasks.some(t => t.status === 'Running')) {
        throw new Error('Projects with running tasks cannot be deleted');
      }

      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);

      return { project, tasks };
    })();

    if (result) {
      for (const task of result.tasks) {
        this.emit('task-deleted', task);
      }
    }
    return result;
  }

  async appendTerminalEvent(id, event) {
    if (!this.db) await this.init();

    const task = this.db.transaction(() => {
      const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!row) return null;
      const t = this.#parseTaskRow(row);

      this.db.prepare('INSERT INTO task_events (taskId, event) VALUES (?, ?)').run(id, JSON.stringify(event));
      
      const updatedAt = new Date().toISOString();
      this.db.prepare('UPDATE tasks SET updatedAt = ? WHERE id = ?').run(updatedAt, id);
      
      const eventsRows = this.db.prepare('SELECT event FROM task_events WHERE taskId = ? ORDER BY id ASC').all(id);
      t.terminalEvents = eventsRows.map(e => JSON.parse(e.event));
      t.updatedAt = updatedAt;
      
      return t;
    })();

    if (task) {
      this.emit('terminal', { taskId: id, event });
    }
    return task;
  }

  async createRunArtifact(taskId, sessionRef) {
    const runDir = path.join(this.runsDir, `${taskId}-${sessionRef}`);
    await mkdir(runDir, { recursive: true });
    return runDir;
  }

  async writeRunFile(runDir, fileName, content) {
    await writeFile(path.join(runDir, fileName), content, 'utf8');
  }

  #parseTaskRow(row) {
    return {
      ...row,
      tokenUsage: row.tokenUsage ? JSON.parse(row.tokenUsage) : null,
      messages: row.messages ? JSON.parse(row.messages) : [],
      needsInput: row.needsInput ? JSON.parse(row.needsInput) : { active: false, reason: 'manual', message: '', createdAt: null }
    };
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
