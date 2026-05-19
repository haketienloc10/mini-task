import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from '../src/server.mjs';
import { TaskStore } from '../src/taskStore.mjs';

test('HTTP API creates, lists, details, and runs a task', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-api-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({
    store,
    runnerOptions: {
      command: process.execPath,
      args: [path.resolve('scripts/fake-codex-runner.mjs')],
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'API task',
        description: 'Run through HTTP',
        workspacePath: workspace,
        subagent: 'generator',
        notes: 'smoke'
      })
    });
    assert.equal(created.status, 'Assigned');

    const tasks = await request(`${baseUrl}/api/tasks`);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'API task');

    const detail = await request(`${baseUrl}/api/tasks/${created.id}`);
    assert.equal(detail.subagent, 'generator');
    assert.equal(detail.workspacePath, workspace);

    const run = await request(`${baseUrl}/api/tasks/${created.id}/run`, { method: 'POST' });
    assert.equal(run.status, 'Done');
    assert.match(run.output, /fake codex output/);
    assert.ok(run.startedAt);
    assert.ok(run.finishedAt);
    assert.ok(run.sessionRef);
    assert.ok(run.processRef);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP API runs default codex command in the task workspace', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-api-default-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const command = path.join(root, 'codex-shim.mjs');
  await writeFile(command, [
    '#!/usr/bin/env node',
    'const args = process.argv.slice(2);',
    'if (args.includes("--cwd")) {',
    '  console.error("unexpected argument \'--cwd\' found");',
    '  process.exit(2);',
    '}',
    `if (process.cwd() !== ${JSON.stringify(path.resolve(workspace))}) {`,
    '  console.error(`wrong cwd ${process.cwd()}`);',
    '  process.exit(3);',
    '}',
    'console.log(JSON.stringify({ args, cwd: process.cwd() }));'
  ].join('\n'), 'utf8');
  await chmod(command, 0o755);

  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({
    store,
    runnerOptions: {
      command,
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Default runner API task',
        description: 'Run default command path through HTTP',
        workspacePath: workspace,
        subagent: 'generator',
        notes: ''
      })
    });

    const run = await request(`${baseUrl}/api/tasks/${created.id}/run`, { method: 'POST' });
    assert.equal(run.status, 'Done');
    assert.ok(run.sessionRef);
    assert.ok(run.processRef);
    assert.ok(run.runArtifactPath);

    const observed = JSON.parse(run.output);
    assert.deepEqual(observed.args, [
      'exec',
      '--full-auto',
      '-'
    ]);
    assert.equal(observed.cwd, path.resolve(workspace));

    const commandArtifact = JSON.parse(await readFile(path.join(run.runArtifactPath, 'command.json'), 'utf8'));
    assert.equal(commandArtifact.args.includes('--cwd'), false);
    assert.equal(commandArtifact.args.includes('--prompt-file'), false);
    assert.equal(commandArtifact.cwd, path.resolve(workspace));
    assert.equal(commandArtifact.stdin, '<prompt>');

    const stderr = await readFile(path.join(run.runArtifactPath, 'stderr.log'), 'utf8');
    assert.doesNotMatch(stderr, /unexpected argument '--cwd' found/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  const data = await response.json();
  assert.equal(response.ok, true, data.error);
  return data;
}
