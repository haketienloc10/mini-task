# Phase 2: Event-Driven SSE and Performance Fixes - Plan

## 1. Make TaskStore an EventEmitter
- **Task:** Update `src/taskStore.mjs`.
- **Action:** 
  - Import `EventEmitter` from `node:events`.
  - Class `TaskStore` extends `EventEmitter`.
  - In `createTask`, emit `task-created` with the new task.
  - In `updateTask`, emit `task-updated` with the updated task.
  - In `deleteTask`, emit `task-deleted` with the deleted task.
  - In `appendTerminalEvent`, emit `terminal` with `{ taskId, event }`.
  - In `deleteProject`, emit `task-deleted` for all tasks under the project.

## 2. Implement IPC for Detached Task Workers
- **Task:** Stream events from detached `taskWorker.mjs` back to the server process.
- **Action:** 
  - Update `server.mjs` inside `startTaskWorker` to use `stdio: ['ignore', 'ignore', 'ignore', 'ipc']`.
  - Add `child.on('message', (msg) => store.emit(msg.type, ...msg.args))` to forward IPC messages to the main store's event emitter.
  - Ensure `child.unref()` still works with the IPC channel. To allow the child to live after parent dies, `taskWorker.mjs` must gracefully handle `process.on('disconnect')` and ignore it.
  - In `src/taskWorker.mjs`, listen to `store` events (`task-updated`, `terminal`, etc.) and send them to parent if `process.send` is available.

## 3. Refactor SSE Endpoints in `server.mjs`
- **Task:** Remove the aggressive 250ms polling loop.
- **Action:** 
  - Remove `setInterval` polling loop (`pollTimer`), `pollTaskChanges`, `taskUpdateSignature`, `knownTaskSignatures`.
  - In `/api/tasks/events` (the task lifecycle SSE endpoint):
    - Subscribe directly to `store.on('task-created')`, `store.on('task-updated')`, and `store.on('task-deleted')`.
    - Push `enrichTask(task)` to SSE clients.
  - In `/api/tasks/:taskId/terminal-events` (the terminal SSE endpoint):
    - Subscribe directly to `store.on('terminal')`.
    - Check if `data.taskId === taskId`. If yes, push the event to SSE clients.
  - Clean up event listeners on `req.on('close')`.

## 4. Test and Verify
- **Task:** Run all tests.
- **Action:** 
  - Run `npm test`.
  - Ensure `tests/server-api.test.mjs` streaming tests pass without timeouts.
  - Ensure the "detached task worker continues after the HTTP server stops" test still passes (handling IPC disconnect correctly).
