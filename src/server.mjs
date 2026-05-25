import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { TaskStore } from './taskStore.mjs';
import { findSubagent, listSubagents } from './subagents.mjs';
import { enrichTask, normalizeNeedsInput } from './taskCockpit.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const workerFile = path.resolve(__dirname, 'taskWorker.mjs');
const SSE_POLL_INTERVAL_MS = 250;

export function createServer({ store = new TaskStore(), runnerOptions = {} } = {}) {
  const terminalClients = new Map();
  const taskClients = new Set();
  let pollTimer = null;
  let pollChain = Promise.resolve();
  const knownTaskSignatures = new Map();
  let initPromise = null;
  const ensureStoreReady = async () => {
    initPromise ??= store.init().then(() => recoverInterruptedRunningTasks(store));
    return initPromise;
  };
  const publishTaskEvent = (type, task) => {
    if (!task) return;
    for (const res of taskClients) {
      sendSseEvent(res, type, enrichTask(task));
    }
  };
  const pollTaskChanges = async () => {
    const tasks = await store.listTasks();
    for (const task of tasks) {
      const signature = taskUpdateSignature(task);
      const previousSignature = knownTaskSignatures.get(task.id);
      if (previousSignature && previousSignature !== signature) {
        publishTaskEvent('task-updated', task);
      }
      knownTaskSignatures.set(task.id, signature);

      const clients = terminalClients.get(task.id);
      if (!clients) continue;
      for (const event of task.terminalEvents || []) {
        for (const [res, state] of clients) {
          if (state.sentEventIds.has(event.id)) continue;
          sendSseEvent(res, 'terminal', event, event.id);
          state.sentEventIds.add(event.id);
        }
      }
    }
  };
  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (!taskClients.size && !terminalClients.size) return;
      pollChain = pollChain.then(pollTaskChanges, pollTaskChanges).catch(() => {});
    }, SSE_POLL_INTERVAL_MS);
    pollTimer.unref?.();
  };
  const stopPollingIfIdle = () => {
    if (!pollTimer || taskClients.size || terminalClients.size) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  const server = http.createServer(async (req, res) => {
    try {
      await ensureStoreReady();
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/api/subagents') {
        const project = url.searchParams.get('projectId')
          ? await store.getProject(url.searchParams.get('projectId'))
          : null;
        return sendJson(res, 200, listSubagents({
          homeCodexDir: runnerOptions.homeCodexDir,
          projectPath: project?.workspacePath
        }));
      }

      if (req.method === 'GET' && url.pathname === '/api/projects') {
        return sendJson(res, 200, await store.listProjects());
      }

      if (req.method === 'POST' && url.pathname === '/api/projects') {
        const body = await readJson(req);
        if (!body.name?.trim()) {
          return sendJson(res, 400, { error: 'Project name is required' });
        }
        if (!body.workspacePath?.trim()) {
          return sendJson(res, 400, { error: 'Workspace path is required' });
        }
        const project = await store.createProject(body);
        return sendJson(res, 201, project);
      }

      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (req.method === 'DELETE' && projectMatch) {
        try {
          const deleted = await store.deleteProject(projectMatch[1]);
          if (!deleted) return sendJson(res, 404, { error: 'Project not found' });
          for (const task of deleted.tasks) {
            publishTaskEvent('task-deleted', task);
          }
          return sendJson(res, 200, deleted);
        } catch (error) {
          return sendJson(res, 409, { error: error.message });
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/tasks') {
        return sendJson(res, 200, enrichTasks(await store.listTasks()));
      }

      if (req.method === 'GET' && url.pathname === '/api/tasks/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive'
        });
        res.write('retry: 1000\n\n');
        sendSseEvent(res, 'task-snapshot', enrichTasks(await store.listTasks()));

        taskClients.add(res);
        startPolling();
        req.on('close', () => {
          taskClients.delete(res);
          stopPollingIfIdle();
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJson(req);
        const validation = await validateTaskInput(body, store, runnerOptions);
        if (validation) return sendJson(res, 400, { error: validation });
        try {
          const task = await store.createTask(body);
          publishTaskEvent('task-created', task);
          return sendJson(res, 201, enrichTask(task));
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (req.method === 'GET' && taskMatch) {
        const task = await store.getTask(taskMatch[1]);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, enrichTask(task));
      }

      if (req.method === 'DELETE' && taskMatch) {
        try {
          const task = await store.deleteTask(taskMatch[1]);
          if (!task) return sendJson(res, 404, { error: 'Task not found' });
          publishTaskEvent('task-deleted', task);
          return sendJson(res, 200, enrichTask(task));
        } catch (error) {
          return sendJson(res, 409, { error: error.message });
        }
      }

      const terminalEventsMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/terminal-events$/);
      if (req.method === 'GET' && terminalEventsMatch) {
        const taskId = terminalEventsMatch[1];
        const task = await store.getTask(taskId);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });

        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive'
        });
        res.write('retry: 1000\n\n');

        if (!terminalClients.has(taskId)) terminalClients.set(taskId, new Map());
        const clientState = { sentEventIds: new Set() };
        terminalClients.get(taskId).set(res, clientState);
        for (const event of task.terminalEvents || []) {
          sendSseEvent(res, 'terminal', event, event.id);
          clientState.sentEventIds.add(event.id);
        }
        startPolling();
        req.on('close', () => {
          const clients = terminalClients.get(taskId);
          if (!clients) return;
          clients.delete(res);
          if (!clients.size) terminalClients.delete(taskId);
          stopPollingIfIdle();
        });
        return;
      }

      const runMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/run$/);
      if (req.method === 'POST' && runMatch) {
        const task = await store.getTask(runMatch[1]);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });

        let body = {};
        try {
          body = await readJson(req);
        } catch (e) {
          // ignore
        }

        const mode = resolveRunMode(body, task);
        const runValidation = validateRunMode(mode, body, enrichTask(task).actions);
        if (runValidation) return sendJson(res, runValidation.status, { error: runValidation.error });

        const { taskForRun, runOptions } = prepareTaskRun(task, body, mode, runnerOptions);
        const startedTask = await store.updateTask(task.id, {
          sessionRef: taskForRun.sessionRef,
          messages: taskForRun.messages,
          status: 'Running',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          processRef: null,
          output: '',
          log: taskForRun.sessionRef ? `Resuming session ${taskForRun.sessionRef}\n` : 'Starting new session\n',
          error: '',
          tokenUsage: null
        });
        knownTaskSignatures.set(startedTask.id, taskUpdateSignature(startedTask));
        const workerRef = startTaskWorker({
          taskId: task.id,
          dataDir: store.dataDir,
          runnerOptions: runOptions
        });
        const taskWithWorker = await store.updateTask(task.id, {
          workerRef: String(workerRef),
          workerHeartbeatAt: new Date().toISOString()
        });
        publishTaskEvent('task-updated', startedTask);
        return sendJson(res, 202, enrichTask(taskWithWorker));
      }

      const needsInputMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/needs-input$/);
      if (req.method === 'PATCH' && needsInputMatch) {
        const task = await store.getTask(needsInputMatch[1]);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });
        const body = await readJson(req);
        if (task.status === 'Running' && body.active !== false) {
          return sendJson(res, 409, { error: 'Cannot mark a running task as needing input' });
        }

        const needsInput = body.active === false
          ? { active: false, reason: 'manual', message: '', createdAt: null }
          : normalizeNeedsInput({
              active: true,
              reason: body.reason ?? 'manual',
              message: body.message ?? '',
              createdAt: new Date().toISOString()
            });
        const updatedTask = await store.updateTask(task.id, { needsInput });
        publishTaskEvent('task-updated', updatedTask);
        return sendJson(res, 200, enrichTask(updatedTask));
      }

      if (req.method === 'GET') {
        return serveStatic(url.pathname, res);
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  });
  server.on('close', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
  return server;
}

async function recoverInterruptedRunningTasks(store) {
  const tasks = await store.listTasks();
  const now = new Date().toISOString();
  const message = 'Run interrupted because the task app stopped before Codex CLI completed. This run cannot be resumed safely.';

  for (const task of tasks) {
    if (task.status !== 'Running') continue;
    if (isLikelyActiveRun(task)) continue;
    await store.updateTask(task.id, {
      status: 'Failed',
      finishedAt: now,
      currentRunRef: null,
      output: '',
      log: [task.log, message].filter(Boolean).join('\n'),
      error: message
    });
  }
}

function startTaskWorker({ taskId, dataDir, runnerOptions }) {
  const payload = JSON.stringify({
    taskId,
    dataDir,
    runnerOptions: serializableRunnerOptions(runnerOptions)
  });
  const child = spawn(process.execPath, [workerFile], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CODEX_TASK_WORKER_PAYLOAD: payload
    }
  });
  child.unref();
  return child.pid;
}

function serializableRunnerOptions(options) {
  return Object.fromEntries(
    Object.entries(options)
      .filter(([, value]) => typeof value !== 'function' && value !== undefined)
  );
}

function enrichTasks(tasks) {
  return tasks.map(enrichTask);
}

function resolveRunMode(body, task) {
  if (body.mode) return body.mode;
  if (body.prompt?.trim()) return task.sessionRef ? 'followup' : 'start';
  if (task.status === 'Failed') return 'retry';
  return task.sessionRef ? 'resume' : 'start';
}

function validateRunMode(mode, body, actions) {
  if (!['start', 'resume', 'retry', 'followup'].includes(mode)) {
    return { status: 400, error: 'Unsupported run mode' };
  }
  if (mode === 'start' && !actions.canStart) {
    return { status: 409, error: 'Task cannot be started in its current state' };
  }
  if (mode === 'resume' && !actions.canResume) {
    return { status: 409, error: 'Task cannot be resumed in its current state' };
  }
  if (mode === 'retry' && !actions.canRetry) {
    return { status: 409, error: 'Task cannot be retried in its current state' };
  }
  if (mode === 'followup') {
    if (!body.prompt?.trim()) return { status: 400, error: 'Follow-up prompt is required' };
    if (!actions.canFollowUp) {
      return { status: 409, error: 'Task cannot accept a follow-up in its current state' };
    }
  }
  return null;
}

function prepareTaskRun(task, body, mode, runnerOptions) {
  const prompt = body.prompt?.trim();
  const isRetry = mode === 'retry';
  const baseTask = isRetry ? { ...task, sessionRef: null } : task;
  let messages = baseTask.messages || [];
  let customPrompt = prompt;

  if (prompt) {
    messages = [
      ...messages,
      {
        id: randomUUID(),
        sender: 'user',
        content: prompt,
        createdAt: new Date().toISOString()
      }
    ];
  } else if (!messages.length) {
    customPrompt = [baseTask.description, baseTask.notes].filter(Boolean).join('\n\n');
    messages = [
      {
        id: randomUUID(),
        sender: 'user',
        content: customPrompt,
        createdAt: new Date().toISOString()
      }
    ];
  } else {
    const lastUserMsg = [...messages].reverse().find((message) => message.sender === 'user');
    customPrompt = lastUserMsg?.content;
  }

  return {
    taskForRun: {
      ...baseTask,
      messages
    },
    runOptions: customPrompt
      ? { ...runnerOptions, customPrompt }
      : runnerOptions
  };
}

function isLikelyActiveRun(task) {
  return processExists(task.workerRef) || processExists(task.processRef);
}

function processExists(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) return false;
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

function taskUpdateSignature(task) {
  const {
    currentRunRef,
    terminalEvents,
    updatedAt,
    workerHeartbeatAt,
    workerRef,
    ...taskState
  } = task;
  return JSON.stringify(taskState);
}

async function validateTaskInput(body, store, runnerOptions) {
  if (!body || typeof body !== 'object') return 'Request body must be an object';
  if (!body.projectId?.trim()) return 'Project ID is required';
  if (!body.title?.trim()) return 'Title is required';
  if (!body.description?.trim()) return 'Description is required';
  const project = await store.getProject(body.projectId);
  if (!findSubagent(body.subagent, {
    homeCodexDir: runnerOptions.homeCodexDir,
    projectPath: project?.workspacePath
  })) return 'Subagent is required';
  return null;
}

async function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(publicDir, `.${safePath}`);
  if (!filePath.startsWith(publicDir)) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const content = await readFile(filePath);
    const type = contentType(filePath);
    res.writeHead(200, { 'content-type': type });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return sendText(res, 404, 'Not found');
    throw error;
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendSseEvent(res, eventName, data, id = randomUUID()) {
  res.write(`id: ${id}\n`);
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  const dataDir = process.env.CODEX_TASK_DATA_DIR ?? path.resolve('data');
  const server = createServer({ store: new TaskStore({ dataDir }) });
  server.listen(port, () => {
    console.log(`Codex Task Dispatch listening on http://127.0.0.1:${port}`);
  });
}
