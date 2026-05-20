import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { TaskStore } from './taskStore.mjs';
import { runTask } from './runner.mjs';
import { findSubagent, SUBAGENTS } from './subagents.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

export function createServer({ store = new TaskStore(), runnerOptions = {} } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      await store.init();
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/api/subagents') {
        return sendJson(res, 200, SUBAGENTS);
      }

      if (req.method === 'GET' && url.pathname === '/api/projects') {
        return sendJson(res, 200, await store.listProjects());
      }

      if (req.method === 'POST' && url.pathname === '/api/projects') {
        const body = await readJson(req);
        if (!body.name?.trim()) {
          return sendJson(res, 400, { error: 'Project name is required' });
        }
        const project = await store.createProject(body);
        return sendJson(res, 201, project);
      }

      if (req.method === 'GET' && url.pathname === '/api/tasks') {
        return sendJson(res, 200, await store.listTasks());
      }

      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const body = await readJson(req);
        const validation = validateTaskInput(body);
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
        
        let result;
        if (body.prompt?.trim()) {
          const userMessage = {
            id: randomUUID(),
            sender: 'user',
            content: body.prompt.trim(),
            createdAt: new Date().toISOString()
          };
          task.messages = [...(task.messages || []), userMessage];
          await store.updateTask(task.id, { messages: task.messages });
          result = await runTask(task, store, { ...runnerOptions, customPrompt: body.prompt.trim() });
        } else {
          if (!task.messages || task.messages.length === 0) {
            const firstUserMsg = {
              id: randomUUID(),
              sender: 'user',
              content: [task.description, task.notes].filter(Boolean).join('\n\n'),
              createdAt: new Date().toISOString()
            };
            task.messages = [firstUserMsg];
            await store.updateTask(task.id, { messages: task.messages });
            result = await runTask(task, store, runnerOptions);
          } else {
            const lastUserMsg = [...task.messages].reverse().find(m => m.sender === 'user');
            result = await runTask(task, store, { ...runnerOptions, customPrompt: lastUserMsg?.content });
          }
        }
        return sendJson(res, 200, result);
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

function validateTaskInput(body) {
  if (!body || typeof body !== 'object') return 'Request body must be an object';
  if (!body.projectId?.trim()) return 'Project ID is required';
  if (!body.title?.trim()) return 'Title is required';
  if (!body.description?.trim()) return 'Description is required';
  if (!body.workspacePath?.trim()) return 'Workspace path is required';
  if (!findSubagent(body.subagent)) return 'Subagent is required';
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  const dataDir = process.env.CODEX_TASK_DATA_DIR ?? path.resolve('data');
  const server = createServer({ store: new TaskStore({ dataDir }) });
  server.listen(port, () => {
    console.log(`Codex Task Dispatch listening on http://127.0.0.1:${port}`);
  });
}
