import { TaskStore } from './taskStore.mjs';
import { runTask } from './runner.mjs';

const payload = JSON.parse(process.env.CODEX_TASK_WORKER_PAYLOAD ?? '{}');
const { taskId, dataDir, runnerOptions = {} } = payload;

if (!taskId || !dataDir) {
  throw new Error('Worker payload must include taskId and dataDir');
}

const store = new TaskStore({ dataDir });

if (process.send) {
  store.on('task-updated', task => process.send({ type: 'task-updated', data: task }));
  store.on('terminal', data => process.send({ type: 'terminal', data }));
  
  process.on('disconnect', () => {
    // Keep running even if the HTTP server parent disconnects
  });
}

await store.init();

const task = await store.getTask(taskId);
if (!task) {
  throw new Error(`Task not found: ${taskId}`);
}

try {
  await store.updateTask(taskId, {
    workerRef: String(process.pid),
    workerHeartbeatAt: new Date().toISOString()
  });
  await runTask(task, store, runnerOptions);
} catch (error) {
  await store.updateTask(taskId, {
    status: 'Failed',
    finishedAt: new Date().toISOString(),
    currentRunRef: null,
    output: '',
    log: [task.log, 'Worker failed before completion'].filter(Boolean).join('\n'),
    error: error.message
  });
  process.exitCode = 1;
} finally {
  await store.updateTask(taskId, {
    workerRef: null,
    workerHeartbeatAt: null
  });
  await store.close();
  process.exit(process.exitCode || 0);
}
