import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { findSubagent } from './subagents.mjs';

const DEFAULT_TIMEOUT_MS = Number(process.env.CODEX_TASK_TIMEOUT_MS ?? 1800000);

export async function runTask(task, store, options = {}) {
  const startedAt = new Date().toISOString();
  const runRef = randomUUID();
  const runArtifactPath = await store.createRunArtifact(task.id, runRef);
  await store.updateTask(task.id, {
    status: 'Running',
    startedAt,
    finishedAt: null,
    processRef: null,
    runArtifactPath,
    output: '',
    log: task.sessionRef ? `Resuming session ${task.sessionRef}\n` : 'Starting new session\n',
    error: '',
    tokenUsage: null
  });

  try {
    const workspacePath = await resolveTaskWorkspacePath(task, store);
    await validateWorkspacePath(workspacePath);
    const runner = buildRunnerCommand({ ...task, workspacePath }, runArtifactPath, options);
    await store.writeRunFile(runArtifactPath, 'prompt.txt', runner.prompt);
    await store.writeRunFile(runArtifactPath, 'command.json', JSON.stringify({
      command: runner.command,
      args: runner.args,
      cwd: runner.cwd,
      stdin: runner.stdin ? '<prompt>' : null,
      sessionRef: task.sessionRef ?? null,
      runRef
    }, null, 2));

    const result = await executeProcess(runner, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const finishedAt = new Date().toISOString();
    await store.writeRunFile(runArtifactPath, 'stdout.log', result.rawStdout ?? result.stdout);
    await store.writeRunFile(runArtifactPath, 'stderr.log', result.stderr);

    const status = result.exitCode === 0 ? 'Done' : 'Failed';
    const error = result.exitCode === 0 ? '' : `Process exited with code ${result.exitCode}`;
    const sessionRef = result.sessionRef ?? task.sessionRef ?? runRef;

    const agentMessage = {
      id: randomUUID(),
      sender: 'agent',
      content: result.stdout || error || 'Process completed with no output',
      createdAt: finishedAt
    };
    const updatedMessages = [...(task.messages || []), agentMessage];

    return store.updateTask(task.id, {
      status,
      finishedAt,
      sessionRef,
      processRef: result.processRef,
      output: result.stdout,
      log: [
        task.sessionRef ? `Resumed session ${task.sessionRef}` : `Started session ${sessionRef}`,
        `Process reference ${result.processRef}`,
        `Command ${runner.command}`,
        result.stderr ? `stderr:\n${result.stderr}` : ''
      ].filter(Boolean).join('\n'),
      error,
      tokenUsage: result.tokenUsage ?? null,
      messages: updatedMessages
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await store.writeRunFile(runArtifactPath, 'error.log', error.stack ?? error.message);

    const agentMessage = {
      id: randomUUID(),
      sender: 'agent',
      content: error.message,
      createdAt: finishedAt
    };
    const updatedMessages = [...(task.messages || []), agentMessage];

    return store.updateTask(task.id, {
      status: 'Failed',
      finishedAt,
      sessionRef: task.sessionRef ?? runRef,
      output: '',
      log: `${task.sessionRef ? `Resuming session ${task.sessionRef}` : 'Starting new session'}\nFailed before completion`,
      error: error.message,
      tokenUsage: null,
      messages: updatedMessages
    });
  }
}

export async function validateWorkspacePath(workspacePath) {
  const resolved = path.resolve(workspacePath);
  await access(resolved);
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error('Workspace path must be an existing directory');
  }
  return resolved;
}

async function resolveTaskWorkspacePath(task, store) {
  if (task.projectId && typeof store.getProject === 'function') {
    const project = await store.getProject(task.projectId);
    if (project?.workspacePath?.trim()) {
      return project.workspacePath.trim();
    }
  }
  if (task.workspacePath?.trim()) {
    return task.workspacePath.trim();
  }
  throw new Error('Workspace path is required');
}

export function buildRunnerCommand(task, runArtifactPath, options = {}) {
  const subagent = findSubagent(task.subagent, {
    homeCodexDir: options.homeCodexDir,
    projectPath: task.workspacePath
  });
  if (!subagent) {
    throw new Error(`Unknown subagent: ${task.subagent}`);
  }

  const command = options.command ?? process.env.CODEX_TASK_COMMAND ?? 'codex';
  const prompt = options.customPrompt ?? buildPrompt(task, subagent);

  if (options.args) {
    return {
      command,
      args: options.args,
      cwd: path.resolve(task.workspacePath),
      prompt,
      stdin: options.stdin !== undefined ? options.stdin : prompt,
      env: options.env ?? process.env
    };
  }

  const args = task.sessionRef
    ? ['exec', '--sandbox', 'workspace-write', '--json', 'resume', task.sessionRef, '-']
    : ['exec', '--sandbox', 'workspace-write', '--json', '-'];

  return {
    command,
    args,
    cwd: path.resolve(task.workspacePath),
    prompt,
    stdin: prompt,
    env: options.env ?? process.env,
    parseJsonOutput: true
  };
}

function buildPrompt(task, subagent) {
  if (subagent.id === 'default') {
    return [
      task.description,
      task.notes ? `Notes:\n${task.notes}` : ''
    ].filter(Boolean).join('\n\n');
  }

  return [
    `Subagent: ${subagent.role}`,
    `Task: ${task.title}`,
    '',
    task.description,
    task.notes ? `\nNotes:\n${task.notes}` : ''
  ].filter(Boolean).join('\n');
}

export function executeProcess(runner, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(runner.command, runner.args, {
      cwd: runner.cwd,
      env: runner.env,
      shell: false,
      windowsHide: true
    });
    const processRef = String(child.pid);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    if (runner.stdin) {
      child.stdin.end(runner.stdin);
    } else {
      child.stdin.end();
    }
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Process timed out after ${timeoutMs}ms`));
        return;
      }
      if (!runner.parseJsonOutput) {
        resolve({ exitCode, stdout, stderr, processRef });
        return;
      }

      const parsed = parseCodexJsonOutput(stdout);
      resolve({
        exitCode,
        stdout: parsed.finalMessage || stdout,
        rawStdout: stdout,
        stderr,
        processRef,
        sessionRef: parsed.sessionRef,
        tokenUsage: parsed.tokenUsage
      });
    });
  });
}

export function parseCodexJsonOutput(stdout) {
  let sessionRef = null;
  let finalMessage = '';
  let tokenUsage = null;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
      sessionRef = event.thread_id;
    }

    if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
      finalMessage = event.item.text ?? finalMessage;
    }

    if (event.type === 'turn.completed' && event.usage) {
      tokenUsage = normalizeTokenUsage(event.usage);
    }
  }

  return { sessionRef, finalMessage, tokenUsage };
}

function normalizeTokenUsage(usage) {
  const inputTokens = numberOrNull(usage.input_tokens);
  const outputTokens = numberOrNull(usage.output_tokens);
  const totalTokens = numberOrNull(usage.total_tokens)
    ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);

  return {
    totalTokens,
    inputTokens,
    outputTokens
  };
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
