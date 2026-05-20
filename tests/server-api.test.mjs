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
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'API Project', description: 'Test' })
    });
    assert.ok(project.id);

    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
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

test('HTTP API exposes, accepts, and runs default task mode', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-api-default-mode-'));
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
    const subagents = await request(`${baseUrl}/api/subagents`);
    assert.equal(subagents.some((subagent) => subagent.id === 'default' && subagent.label === 'Default'), true);

    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Default Project', description: 'Test default' })
    });
    assert.ok(project.id);

    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Default mode API task',
        description: 'Run default mode through HTTP',
        workspacePath: workspace,
        subagent: 'default',
        notes: ''
      })
    });
    assert.equal(created.status, 'Assigned');
    assert.equal(created.subagent, 'default');

    const detail = await request(`${baseUrl}/api/tasks/${created.id}`);
    assert.equal(detail.subagent, 'default');

    const run = await request(`${baseUrl}/api/tasks/${created.id}/run`, { method: 'POST' });
    assert.equal(run.status, 'Done');
    assert.ok(run.sessionRef);
    assert.ok(run.processRef);

    const prompt = await readFile(path.join(run.runArtifactPath, 'prompt.txt'), 'utf8');
    assert.equal(prompt, 'Run default mode through HTTP');
    assert.doesNotMatch(prompt, /Subagent:/);
    assert.doesNotMatch(prompt, /harness_(planner|generator|plan_reviewer|evaluator)/);
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
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Runner Project', description: 'Test runner' })
    });
    assert.ok(project.id);

    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
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
      '--sandbox',
      'workspace-write',
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

test('HTTP API projects management', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-projects-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({ store });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. List initially empty or default project (if migrated)
    const initialProjects = await request(`${baseUrl}/api/projects`);
    assert.ok(Array.isArray(initialProjects));

    // 2. Create project
    const proj = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Project Alpha', description: 'Alpha test project' })
    });
    assert.ok(proj.id);
    assert.equal(proj.name, 'Project Alpha');
    assert.equal(proj.description, 'Alpha test project');

    // 3. List contains created project
    const currentProjects = await request(`${baseUrl}/api/projects`);
    assert.ok(currentProjects.some(p => p.id === proj.id));

    // 4. Validation: project name is required
    const invalidProjRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' })
    });
    assert.equal(invalidProjRes.status, 400);

    // 5. Validation: createTask requires projectId
    const invalidTaskRes1 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Task without project',
        description: 'Test validation',
        workspacePath: root,
        subagent: 'generator'
      })
    });
    assert.equal(invalidTaskRes1.status, 400);

    // 6. Validation: createTask requires valid projectId
    const invalidTaskRes2 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'non-existent-id',
        title: 'Task with bad project',
        description: 'Test validation',
        workspacePath: root,
        subagent: 'generator'
      })
    });
    assert.equal(invalidTaskRes2.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP API chat session interaction', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-chat-'));
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
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Chat Project', description: 'Testing chat history' })
    });

    const createdTask = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Chat task',
        description: 'First instruction',
        workspacePath: workspace,
        subagent: 'generator',
        notes: 'Some notes'
      })
    });
    assert.ok(createdTask.id);
    assert.deepEqual(createdTask.messages, []);

    // Run first time without custom prompt in body
    const runResult1 = await request(`${baseUrl}/api/tasks/${createdTask.id}/run`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(runResult1.status, 'Done');
    
    // Check updated task messages
    const updatedTask1 = await request(`${baseUrl}/api/tasks/${createdTask.id}`);
    assert.equal(updatedTask1.messages.length, 2); // 1 User, 1 Agent
    assert.equal(updatedTask1.messages[0].sender, 'user');
    assert.match(updatedTask1.messages[0].content, /First instruction/);
    assert.equal(updatedTask1.messages[1].sender, 'agent');
    assert.match(updatedTask1.messages[1].content, /fake codex output/);

    // Send custom prompt (follow-up)
    const runResult2 = await request(`${baseUrl}/api/tasks/${createdTask.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Follow-up question' })
    });
    assert.equal(runResult2.status, 'Done');

    // Check updated task messages
    const updatedTask2 = await request(`${baseUrl}/api/tasks/${createdTask.id}`);
    assert.equal(updatedTask2.messages.length, 4); // 2 User, 2 Agent
    assert.equal(updatedTask2.messages[2].sender, 'user');
    assert.equal(updatedTask2.messages[2].content, 'Follow-up question');
    assert.equal(updatedTask2.messages[3].sender, 'agent');

    // Verify the prompt sent to the runner for the second run was only 'Follow-up question'
    const prompt2 = await readFile(path.join(runResult2.runArtifactPath, 'prompt.txt'), 'utf8');
    assert.equal(prompt2, 'Follow-up question');
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
