import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { TaskStore } from '../src/taskStore.mjs';
import { buildRunnerCommand, parseCodexJsonOutput, runTask } from '../src/runner.mjs';

test('builds default codex exec command without deprecated cwd argument', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-command-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const runArtifactPath = path.join(root, 'run');
  const homeCodexDir = await createCodexAgents(root, ['generator']);

  const runner = buildRunnerCommand({
    title: 'Default command',
    description: 'Inspect default args',
    workspacePath: workspace,
    subagent: 'generator',
    notes: ''
  }, runArtifactPath, { homeCodexDir });

  assert.equal(runner.command, 'codex');
  assert.deepEqual(runner.args, [
    'exec',
    '--sandbox',
    'workspace-write',
    '--json',
    '-'
  ]);
  assert.equal(runner.cwd, path.resolve(workspace));
  assert.match(runner.stdin, /Task: Default command/);
  assert.equal(runner.args.includes('--cwd'), false);
  assert.equal(runner.args.includes('--prompt-file'), false);

  await rm(root, { recursive: true, force: true });
});

test('builds plain prompt for default task mode', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-default-prompt-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const runArtifactPath = path.join(root, 'run');

  const runner = buildRunnerCommand({
    title: 'Plain task',
    description: 'Inspect files and report findings.',
    workspacePath: workspace,
    subagent: 'default',
    notes: 'Keep it short.'
  }, runArtifactPath);

  assert.equal(runner.command, 'codex');
  assert.deepEqual(runner.args, [
    'exec',
    '--sandbox',
    'workspace-write',
    '--json',
    '-'
  ]);
  assert.equal(runner.cwd, path.resolve(workspace));
  assert.equal(runner.prompt, 'Inspect files and report findings.\n\nNotes:\nKeep it short.');
  assert.equal(runner.stdin, runner.prompt);
  assert.doesNotMatch(runner.prompt, /Subagent:/);
  assert.doesNotMatch(runner.prompt, /harness_(planner|generator|plan_reviewer|evaluator)/);
  assert.doesNotMatch(runner.prompt, /Task: Plain task/);

  await rm(root, { recursive: true, force: true });
});

test('builds codex exec resume command when task has a session ref', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-resume-command-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const runArtifactPath = path.join(root, 'run');

  const runner = buildRunnerCommand({
    title: 'Follow up',
    description: 'Continue the prior task.',
    workspacePath: workspace,
    subagent: 'default',
    notes: '',
    sessionRef: '019e44d7-f572-7223-9008-ff923821c88e'
  }, runArtifactPath, { customPrompt: 'Next message' });

  assert.deepEqual(runner.args, [
    'exec',
    '--sandbox',
    'workspace-write',
    '--json',
    'resume',
    '019e44d7-f572-7223-9008-ff923821c88e',
    '-'
  ]);
  assert.equal(runner.stdin, 'Next message');
  assert.equal(runner.parseJsonOutput, true);

  await rm(root, { recursive: true, force: true });
});

test('parses codex json output session and final message', () => {
  const output = [
    JSON.stringify({ type: 'thread.started', thread_id: '019e44d7-f572-7223-9008-ff923821c88e' }),
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Final answer' } })
  ].join('\n');

  assert.deepEqual(parseCodexJsonOutput(output), {
    sessionRef: '019e44d7-f572-7223-9008-ff923821c88e',
    finalMessage: 'Final answer'
  });
});

test('creates, runs, captures output, and isolates sessions per task', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const homeCodexDir = await createCodexAgents(root, ['generator', 'reviewer']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const project = await store.createProject({ name: 'Alpha Project', workspacePath: workspace });

  const first = await store.createTask({
    projectId: project.id,
    title: 'First task',
    description: 'Run first task',
    subagent: 'generator',
    notes: ''
  });
  const second = await store.createTask({
    projectId: project.id,
    title: 'Second task',
    description: 'Run second task',
    subagent: 'reviewer',
    notes: ''
  });

  assert.equal(first.status, 'Assigned');
  assert.equal(second.status, 'Assigned');

  const runnerOptions = {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs')],
    homeCodexDir,
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

test('runs default task mode through an isolated session with plain prompt artifact', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-default-run-'));
  const workspace = await mkdtemp(path.join(root, 'workspace-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const project = await store.createProject({ name: 'Beta Project', workspacePath: workspace });

  const task = await store.createTask({
    projectId: project.id,
    title: 'Default task',
    description: 'Run with a plain prompt.',
    subagent: 'default',
    notes: ''
  });

  const result = await runTask(task, store, {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs')],
    timeoutMs: 5000
  });

  assert.equal(result.status, 'Done');
  assert.ok(result.sessionRef);
  assert.ok(result.processRef);
  assert.ok(result.runArtifactPath);

  const prompt = await readFile(path.join(result.runArtifactPath, 'prompt.txt'), 'utf8');
  assert.equal(prompt, 'Run with a plain prompt.');
  assert.doesNotMatch(prompt, /Subagent:/);
  assert.doesNotMatch(prompt, /harness_(planner|generator|plan_reviewer|evaluator)/);

  await rm(root, { recursive: true, force: true });
});

test('marks task failed when workspace is invalid', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-'));
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const project = await store.createProject({ name: 'Gamma Project', workspacePath: path.join(root, 'missing') });

  const task = await store.createTask({
    projectId: project.id,
    title: 'Bad workspace',
    description: 'Should fail',
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
  const homeCodexDir = await createCodexAgents(root, ['evaluator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const project = await store.createProject({ name: 'Delta Project', workspacePath: workspace });

  const task = await store.createTask({
    projectId: project.id,
    title: 'Runner failure',
    description: 'Should fail',
    subagent: 'evaluator',
    notes: ''
  });

  const result = await runTask(task, store, {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs'), 'fail'],
    homeCodexDir,
    timeoutMs: 5000
  });

  assert.equal(result.status, 'Failed');
  assert.equal(result.error, 'Process exited with code 7');
  assert.match(result.log, /fake codex failure/);

  await rm(root, { recursive: true, force: true });
});

test('TaskStore migrates legacy tasks and creates a default project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-store-migration-'));
  const dataDir = path.join(root, 'data');
  await mkdir(dataDir, { recursive: true });

  const legacyTasks = [
    {
      id: 'legacy-task-1',
      title: 'Legacy Task 1',
      description: 'First description',
      workspacePath: root,
      subagent: 'generator',
      notes: '',
      status: 'Assigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      sessionRef: null,
      processRef: null,
      runArtifactPath: null,
      output: '',
      log: '',
      error: ''
    }
  ];

  await writeFile(path.join(dataDir, 'tasks.json'), JSON.stringify(legacyTasks, null, 2), 'utf8');

  // Load and init store
  const store = new TaskStore({ dataDir });
  await store.init();

  // Verify default project is created
  const projects = await store.listProjects();
  const defaultProj = projects.find(p => p.id === 'default-project');
  assert.ok(defaultProj);
  assert.equal(defaultProj.name, 'Default Project');
  assert.equal(defaultProj.workspacePath, root);

  // Verify task is migrated
  const tasks = await store.listTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].projectId, 'default-project');
  assert.ok(Array.isArray(tasks[0].messages));

  await rm(root, { recursive: true, force: true });
});

test('runTask uses the project workspace instead of task-level workspace', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-project-workspace-'));
  const projectWorkspace = await mkdtemp(path.join(root, 'project-workspace-'));
  const taskWorkspace = await mkdtemp(path.join(root, 'task-workspace-'));
  const homeCodexDir = await createCodexAgents(root, ['generator']);
  const store = new TaskStore({ dataDir: path.join(root, 'data') });
  await store.init();

  const project = await store.createProject({ name: 'Project Workspace', workspacePath: projectWorkspace });
  const task = await store.createTask({
    projectId: project.id,
    title: 'Uses project cwd',
    description: 'Run in project workspace',
    workspacePath: taskWorkspace,
    subagent: 'generator',
    notes: ''
  });

  const result = await runTask(task, store, {
    command: process.execPath,
    args: [path.resolve('scripts/fake-codex-runner.mjs')],
    homeCodexDir,
    timeoutMs: 5000
  });

  assert.equal(result.status, 'Done');
  const commandArtifact = JSON.parse(await readFile(path.join(result.runArtifactPath, 'command.json'), 'utf8'));
  assert.equal(commandArtifact.cwd, path.resolve(projectWorkspace));

  await rm(root, { recursive: true, force: true });
});

async function createCodexAgents(root, names) {
  const homeCodexDir = path.join(root, 'home-codex');
  for (const name of names) {
    const agentDir = path.join(homeCodexDir, name, 'agents');
    await mkdir(agentDir, { recursive: true });
    await writeFile(path.join(agentDir, 'openai.yaml'), [
      'interface:',
      `  display_name: "${titleCase(name)}"`,
      `  short_description: "${name} test agent"`,
      `  default_prompt: "harness_${name}"`
    ].join('\n'), 'utf8');
  }
  return homeCodexDir;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
