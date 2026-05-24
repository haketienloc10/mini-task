import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createServer } from '../src/server.mjs';
import { TaskStore } from '../src/taskStore.mjs';

test('HTTP API creates, lists, details, and runs a task', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-api-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({
    store,
    runnerOptions: {
      command: process.execPath,
      args: [path.resolve('scripts/fake-codex-runner.mjs')],
      homeCodexDir,
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'API Project', description: 'Test', workspacePath: `  ${workspace}  ` })
    });
    assert.ok(project.id);
    assert.equal(project.workspacePath, workspace);

    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'API task',
        description: 'Run through HTTP',
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
    assert.equal(detail.workspacePath, undefined);

    const startedRun = await request(`${baseUrl}/api/tasks/${created.id}/run`, { method: 'POST' });
    assert.equal(startedRun.status, 'Running');

    const run = await waitForTaskStatus(baseUrl, created.id, 'Done');
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

test('HTTP API streams terminal events for a running task', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-terminal-sse-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({
    store,
    runnerOptions: {
      command: process.execPath,
      args: [path.resolve('scripts/fake-codex-runner.mjs')],
      homeCodexDir,
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const controller = new AbortController();

  try {
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Terminal Project', workspacePath: workspace })
    });
    const task = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Terminal stream task',
        description: 'Stream terminal output',
        subagent: 'generator',
        notes: ''
      })
    });

    const streamResponse = await fetch(`${baseUrl}/api/tasks/${task.id}/terminal-events`, {
      signal: controller.signal
    });
    assert.equal(streamResponse.ok, true);
    assert.match(streamResponse.headers.get('content-type'), /text\/event-stream/);

    const eventsPromise = readTerminalEvents(streamResponse, (events) => {
      return events.some((event) => event.type === 'output' && /fake codex output/.test(event.data))
        && events.some((event) => event.type === 'process.exited' && event.exitCode === 0);
    });

    const startedRun = await request(`${baseUrl}/api/tasks/${task.id}/run`, { method: 'POST' });
    assert.equal(startedRun.status, 'Running');

    const events = await Promise.race([
      eventsPromise,
      delay(3000).then(() => assert.fail('Timed out waiting for terminal SSE events'))
    ]);
    assert.equal(events.some((event) => event.type === 'process.started'), true);
    assert.equal(events.some((event) => event.type === 'output' && event.stream === 'stdout'), true);
    assert.equal(events.some((event) => event.type === 'process.exited'), true);

    const run = await waitForTaskStatus(baseUrl, task.id, 'Done');
    assert.equal(run.terminalEvents.length >= events.length, true);
  } finally {
    controller.abort();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP API streams task lifecycle updates', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-lifecycle-sse-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({
    store,
    runnerOptions: {
      command: process.execPath,
      args: [path.resolve('scripts/fake-codex-runner.mjs')],
      homeCodexDir,
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const controller = new AbortController();

  try {
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Lifecycle Project', workspacePath: workspace })
    });

    const streamResponse = await fetch(`${baseUrl}/api/tasks/events`, {
      signal: controller.signal
    });
    assert.equal(streamResponse.ok, true);
    assert.match(streamResponse.headers.get('content-type'), /text\/event-stream/);

    let taskId;
    const updatesPromise = readTerminalEvents(streamResponse, (events) => {
      const taskEvents = taskId ? events.filter((task) => task.id === taskId) : events;
      return taskEvents.some((task) => task.status === 'Assigned')
        && taskEvents.some((task) => task.status === 'Running')
        && taskEvents.some((task) => task.status === 'Done');
    });

    const task = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Lifecycle stream task',
        description: 'Stream task status',
        subagent: 'generator',
        notes: ''
      })
    });
    taskId = task.id;

    const startedRun = await request(`${baseUrl}/api/tasks/${task.id}/run`, { method: 'POST' });
    assert.equal(startedRun.status, 'Running');

    const events = await Promise.race([
      updatesPromise,
      delay(3000).then(() => assert.fail('Timed out waiting for task lifecycle SSE events'))
    ]);
    const taskEvents = events.filter((event) => event.id === task.id);
    assert.deepEqual([...new Set(taskEvents.map((event) => event.status))], ['Assigned', 'Running', 'Done']);
  } finally {
    controller.abort();
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
      body: JSON.stringify({ name: 'Default Project', description: 'Test default', workspacePath: workspace })
    });
    assert.ok(project.id);

    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Default mode API task',
        description: 'Run default mode through HTTP',
        subagent: 'default',
        notes: ''
      })
    });
    assert.equal(created.status, 'Assigned');
    assert.equal(created.subagent, 'default');

    const detail = await request(`${baseUrl}/api/tasks/${created.id}`);
    assert.equal(detail.subagent, 'default');

    const startedRun = await request(`${baseUrl}/api/tasks/${created.id}/run`, { method: 'POST' });
    assert.equal(startedRun.status, 'Running');

    const run = await waitForTaskStatus(baseUrl, created.id, 'Done');
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
  const homeCodexDir = await createCodexAgents(root, ['generator']);
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
      homeCodexDir,
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Runner Project', description: 'Test runner', workspacePath: workspace })
    });
    assert.ok(project.id);

    const created = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Default runner API task',
        description: 'Run default command path through HTTP',
        workspacePath: path.join(root, 'client-controlled-workspace'),
        subagent: 'generator',
        notes: ''
      })
    });

    const startedRun = await request(`${baseUrl}/api/tasks/${created.id}/run`, { method: 'POST' });
    assert.equal(startedRun.status, 'Running');

    const run = await waitForTaskStatus(baseUrl, created.id, 'Done');
    assert.ok(run.sessionRef);
    assert.ok(run.processRef);
    assert.ok(run.runArtifactPath);

    const observed = JSON.parse(run.output);
    assert.deepEqual(observed.args, [
      'exec',
      '--sandbox',
      'workspace-write',
      '--json',
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
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({ store, runnerOptions: { homeCodexDir } });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. List initially empty or default project (if migrated)
    const initialProjects = await request(`${baseUrl}/api/projects`);
    assert.ok(Array.isArray(initialProjects));

    // 2. Create project
    const proj = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Project Alpha', description: 'Alpha test project', workspacePath: ` ${root} ` })
    });
    assert.ok(proj.id);
    assert.equal(proj.name, 'Project Alpha');
    assert.equal(proj.description, 'Alpha test project');
    assert.equal(proj.workspacePath, root);

    // 3. List contains created project
    const currentProjects = await request(`${baseUrl}/api/projects`);
    assert.ok(currentProjects.some(p => p.id === proj.id));

    // 4. Validation: project name is required
    const invalidProjRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', workspacePath: root })
    });
    assert.equal(invalidProjRes.status, 400);

    // 5. Validation: project workspacePath is required
    const invalidProjWorkspaceRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing workspace', workspacePath: ' ' })
    });
    assert.equal(invalidProjWorkspaceRes.status, 400);

    // 6. Validation: createTask requires projectId
    const invalidTaskRes1 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Task without project',
        description: 'Test validation',
        subagent: 'generator'
      })
    });
    assert.equal(invalidTaskRes1.status, 400);

    // 7. Validation: createTask requires valid projectId
    const invalidTaskRes2 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 'non-existent-id',
        title: 'Task with bad project',
        description: 'Test validation',
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
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({
    store,
    runnerOptions: {
      command: process.execPath,
      args: [path.resolve('scripts/fake-codex-runner.mjs')],
      homeCodexDir,
      timeoutMs: 5000
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Chat Project', description: 'Testing chat history', workspacePath: workspace })
    });

    const createdTask = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Chat task',
        description: 'First instruction',
        subagent: 'generator',
        notes: 'Some notes'
      })
    });
    assert.ok(createdTask.id);
    assert.deepEqual(createdTask.messages, []);

    // Run first time without custom prompt in body
    const startedRun1 = await request(`${baseUrl}/api/tasks/${createdTask.id}/run`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(startedRun1.status, 'Running');
    
    // Check updated task messages
    const updatedTask1 = await waitForTaskStatus(baseUrl, createdTask.id, 'Done');
    assert.equal(updatedTask1.messages.length, 2); // 1 User, 1 Agent
    assert.equal(updatedTask1.messages[0].sender, 'user');
    assert.match(updatedTask1.messages[0].content, /First instruction/);
    assert.equal(updatedTask1.messages[1].sender, 'agent');
    assert.match(updatedTask1.messages[1].content, /fake codex output/);

    // Send custom prompt (follow-up)
    const startedRun2 = await request(`${baseUrl}/api/tasks/${createdTask.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Follow-up question' })
    });
    assert.equal(startedRun2.status, 'Running');

    // Check updated task messages
    const updatedTask2 = await waitForTaskStatus(baseUrl, createdTask.id, 'Done');
    assert.equal(updatedTask2.messages.length, 4); // 2 User, 2 Agent
    assert.equal(updatedTask2.messages[2].sender, 'user');
    assert.equal(updatedTask2.messages[2].content, 'Follow-up question');
    assert.equal(updatedTask2.messages[3].sender, 'agent');

    // Verify the prompt sent to the runner for the second run was only 'Follow-up question'
    const prompt2 = await readFile(path.join(updatedTask2.runArtifactPath, 'prompt.txt'), 'utf8');
    assert.equal(prompt2, 'Follow-up question');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP API resumes the existing codex session for follow-up chat', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-session-resume-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const command = path.join(root, 'codex-json-shim.mjs');
  const argsLog = path.join(root, 'args.jsonl');
  const sessionId = '019e44d7-f572-7223-9008-ff923821c88e';

  await writeFile(command, [
    '#!/usr/bin/env node',
    'import { appendFileSync } from "node:fs";',
    `appendFileSync(${JSON.stringify(argsLog)}, JSON.stringify(process.argv.slice(2)) + "\\n");`,
    `console.log(JSON.stringify({ type: "thread.started", thread_id: ${JSON.stringify(sessionId)} }));`,
    'console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "shim final output" } }));'
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
      body: JSON.stringify({ name: 'Resume Project', workspacePath: workspace })
    });
    const task = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'Resume task',
        description: 'Start session',
        subagent: 'default',
        notes: ''
      })
    });

    const firstStartedRun = await request(`${baseUrl}/api/tasks/${task.id}/run`, { method: 'POST' });
    assert.equal(firstStartedRun.status, 'Running');

    const firstRun = await waitForTaskStatus(baseUrl, task.id, 'Done');
    assert.equal(firstRun.sessionRef, sessionId);
    assert.equal(firstRun.output, 'shim final output');

    const secondStartedRun = await request(`${baseUrl}/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Follow up' })
    });
    assert.equal(secondStartedRun.status, 'Running');

    const secondRun = await waitForTaskStatus(baseUrl, task.id, 'Done');
    assert.equal(secondRun.sessionRef, sessionId);

    const invocations = (await readFile(argsLog, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    assert.deepEqual(invocations[0], ['exec', '--sandbox', 'workspace-write', '--json', '-']);
    assert.deepEqual(invocations[1], [
      'exec',
      '--sandbox',
      'workspace-write',
      '--json',
      'resume',
      sessionId,
      '-'
    ]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('HTTP API exposes project-scoped codex agents', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-subagents-api-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  await writeAgent(path.join(workspace, '.codex'), 'project-reviewer', 'Project Reviewer');
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  const server = createServer({ store, runnerOptions: { homeCodexDir } });

  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Scoped Project', workspacePath: workspace })
    });

    const globalAgents = await request(`${baseUrl}/api/subagents`);
    assert.equal(globalAgents.some((agent) => agent.id === 'generator'), true);
    assert.equal(globalAgents.some((agent) => agent.id === 'project-reviewer'), false);

    const projectAgents = await request(`${baseUrl}/api/subagents?projectId=${project.id}`);
    assert.equal(projectAgents.some((agent) => agent.id === 'default'), true);
    assert.equal(projectAgents.some((agent) => agent.id === 'generator'), true);
    assert.equal(projectAgents.some((agent) => agent.id === 'project-reviewer'), true);
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

async function waitForTaskStatus(baseUrl, taskId, status, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let task;

  while (Date.now() < deadline) {
    task = await request(`${baseUrl}/api/tasks/${taskId}`);
    if (task.status === status) return task;
    await delay(50);
  }

  assert.fail(`Timed out waiting for task ${taskId} to reach ${status}; last status was ${task?.status}`);
}

async function readTerminalEvents(response, isComplete) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) return events;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine) {
        events.push(JSON.parse(dataLine.slice(6)));
        if (isComplete(events)) return events;
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}

async function createCodexAgents(root, names) {
  const homeCodexDir = path.join(root, 'home-codex');
  for (const name of names) {
    await writeAgent(homeCodexDir, name, titleCase(name));
  }
  return homeCodexDir;
}

async function writeAgent(codexDir, id, label) {
  const agentDir = path.join(codexDir, id, 'agents');
  await mkdir(agentDir, { recursive: true });
  await writeFile(path.join(agentDir, 'openai.yaml'), [
    'interface:',
    `  display_name: "${label}"`,
    `  short_description: "${id} test agent"`,
    `  default_prompt: "harness_${id}"`
  ].join('\n'), 'utf8');
}

function titleCase(value) {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
