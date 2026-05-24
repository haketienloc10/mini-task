import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { TaskStore } from './taskStore.mjs';
import { runTask } from './runner.mjs';
import { findSubagent, listSubagents } from './subagents.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

export function createServer({ store = new TaskStore(), runnerOptions = {} } = {}) {
  const terminalClients = new Map();
  const publishTerminalEvent = (taskId, event) => {
    for (const res of terminalClients.get(taskId) ?? []) {
      sendSseEvent(res, event);
    }
  };

  const server = http.createServer(async (req, res) => {
    try {
      await store.init();
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

      if (req.method === 'GET' && url.pathname === '/api/tasks') {
        return sendJson(res, 200, await store.listTasks());
      }

      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJson(req);
        const validation = await validateTaskInput(body, store, runnerOptions);
        if (validation) return sendJson(res, 400, { error: validation });
        try {
          const task = await store.createTask(body);
          return sendJson(res, 201, task);
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (req.method === 'GET' && taskMatch) {
        const task = await store.getTask(taskMatch[1]);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, task);
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

        if (!terminalClients.has(taskId)) terminalClients.set(taskId, new Set());
        terminalClients.get(taskId).add(res);
        for (const event of task.terminalEvents || []) {
          sendSseEvent(res, event);
        }
        req.on('close', () => {
          const clients = terminalClients.get(taskId);
          if (!clients) return;
          clients.delete(res);
          if (!clients.size) terminalClients.delete(taskId);
        });
        return;
      }

      const runMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/run$/);
      if (req.method === 'POST' && runMatch) {
        const task = await store.getTask(runMatch[1]);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });
        if (task.status === 'Running') return sendJson(res, 409, { error: 'Task is already running' });
        
        let body = {};
        try {
          body = await readJson(req);
        } catch (e) {
          // ignore
        }
        
        let taskForRun = task;
        let runOptions = runnerOptions;
        if (body.prompt?.trim()) {
          const userMessage = {
            id: randomUUID(),
            sender: 'user',
            content: body.prompt.trim(),
            createdAt: new Date().toISOString()
          };
          taskForRun = {
            ...task,
            messages: [...(task.messages || []), userMessage]
          };
          runOptions = { ...runnerOptions, customPrompt: body.prompt.trim() };
        } else {
          if (!task.messages || task.messages.length === 0) {
            const firstUserMsg = {
              id: randomUUID(),
              sender: 'user',
              content: [task.description, task.notes].filter(Boolean).join('\n\n'),
              createdAt: new Date().toISOString()
            };
            taskForRun = {
              ...task,
              messages: [firstUserMsg]
            };
          } else {
            const lastUserMsg = [...task.messages].reverse().find(m => m.sender === 'user');
            runOptions = { ...runnerOptions, customPrompt: lastUserMsg?.content };
          }
        }
        runOptions = {
          ...runOptions,
          onTerminalEvent(taskId, event) {
            runnerOptions.onTerminalEvent?.(taskId, event);
            publishTerminalEvent(taskId, event);
          }
        };
        const startedTask = await store.updateTask(task.id, {
          messages: taskForRun.messages,
          status: 'Running',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          processRef: null,
          output: '',
          log: task.sessionRef ? `Resuming session ${task.sessionRef}\n` : 'Starting new session\n',
          error: '',
          tokenUsage: null
        });
        runTask(taskForRun, store, runOptions).catch((error) => {
          console.error(`Background task run failed for ${task.id}:`, error);
        });
        return sendJson(res, 202, startedTask);
      }

      if (req.method === 'GET') {
        return serveStatic(url.pathname, res);
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  });
  return server;
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

function sendSseEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write('event: terminal\n');
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  const dataDir = process.env.CODEX_TASK_DATA_DIR ?? path.resolve('data');
  const server = createServer({ store: new TaskStore({ dataDir }) });
  server.listen(port, () => {
    console.log(`Codex Task Dispatch listening on http://127.0.0.1:${port}`);
  });
}
