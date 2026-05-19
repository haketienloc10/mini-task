import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { TaskStore } from '../src/taskStore.mjs';
import { buildRunnerCommand, runTask } from '../src/runner.mjs';

test('builds default codex exec command without deprecated cwd argument', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-command-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const runArtifactPath = path.join(root, 'run');

  const runner = buildRunnerCommand({
    title: 'Default command',
    description: 'Inspect default args',
    workspacePath: workspace,
    subagent: 'generator',
    notes: ''
  }, runArtifactPath);

  assert.equal(runner.command, 'codex');
  assert.deepEqual(runner.args, [
    'exec',
    '--full-auto',
    '-'
  ]);
  assert.equal(runner.cwd, path.resolve(workspace));
  assert.match(runner.stdin, /Task: Default command/);
  assert.equal(runner.args.includes('--cwd'), false);
  assert.equal(runner.args.includes('--prompt-file'), false);

  await rm(root, { recursive: true, force: true });
});

test('creates, runs, captures output, and isolates sessions per task', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const first = await store.createTask({
    title: 'First task',
    description: 'Run first task',
    workspacePath: workspace,
    subagent: 'generator',
    notes: ''
  });
  const second = await store.createTask({
    title: 'Second task',
    description: 'Run second task',
    workspacePath: workspace,
    subagent: 'reviewer',
    notes: ''
  });

  assert.equal(first.status, 'Assigned');
  assert.equal(second.status, 'Assigned');

  const runnerOptions = {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs')],
    timeoutMs: 5000
  };
  const firstResult = await runTask(first, store, runnerOptions);
  const secondResult = await runTask(second, store, runnerOptions);

  assert.equal(firstResult.status, 'Done');
  assert.equal(secondResult.status, 'Done');
  assert.match(firstResult.output, /fake codex output/);
  assert.match(secondResult.output, /fake codex output/);
  assert.ok(firstResult.sessionRef);
  assert.ok(secondResult.sessionRef);
  assert.notEqual(firstResult.sessionRef, secondResult.sessionRef);
  assert.ok(firstResult.runArtifactPath);
  assert.ok(secondResult.runArtifactPath);
  assert.notEqual(firstResult.runArtifactPath, secondResult.runArtifactPath);

  await rm(root, { recursive: true, force: true });
});

test('marks task failed when workspace is invalid', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const task = await store.createTask({
    title: 'Bad workspace',
    description: 'Should fail',
    workspacePath: path.join(root, 'missing'),
    subagent: 'planner',
    notes: ''
  });

  const result = await runTask(task, store, {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs')],
    timeoutMs: 5000
  });

  assert.equal(result.status, 'Failed');
  assert.match(result.error, /ENOENT|no such file/i);
  assert.ok(result.sessionRef);
  assert.ok(result.finishedAt);

  await rm(root, { recursive: true, force: true });
});

test('marks task failed when runner exits with non-zero code', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const task = await store.createTask({
    title: 'Runner failure',
    description: 'Should fail',
    workspacePath: workspace,
    subagent: 'evaluator',
    notes: ''
  });

  const result = await runTask(task, store, {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs'), 'fail'],
    timeoutMs: 5000
  });

  assert.equal(result.status, 'Failed');
  assert.equal(result.error, 'Process exited with code 7');
  assert.match(result.log, /fake codex failure/);

  await rm(root, { recursive: true, force: true });
});
