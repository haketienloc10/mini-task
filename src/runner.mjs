import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { findSubagent } from './subagents.mjs';

const DEFAULT_TIMEOUT_MS = Number(process.env.CODEX_TASK_TIMEOUT_MS ?? 120000);

export async function runTask(task, store, options = {}) {
  const startedAt = new Date().toISOString();
  const sessionRef = randomUUID();
  const runArtifactPath = await store.createRunArtifact(task.id, sessionRef);
  await store.updateTask(task.id, {
    status: 'Running',
    startedAt,
    finishedAt: null,
    sessionRef,
    processRef: null,
    runArtifactPath,
    output: '',
    log: `Started session ${sessionRef}\n`,
    error: ''
  });

  try {
    await validateWorkspacePath(task.workspacePath);
    const runner = buildRunnerCommand(task, runArtifactPath, options);
    await store.writeRunFile(runArtifactPath, 'prompt.txt', runner.prompt);
    await store.writeRunFile(runArtifactPath, 'command.json', JSON.stringify({
      command: runner.command,
      args: runner.args,
      cwd: runner.cwd,
      stdin: runner.stdin ? '<prompt>' : null,
      sessionRef
    }, null, 2));

    const result = await executeProcess(runner, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const finishedAt = new Date().toISOString();
    await store.writeRunFile(runArtifactPath, 'stdout.log', result.stdout);
    await store.writeRunFile(runArtifactPath, 'stderr.log', result.stderr);

    const status = result.exitCode === 0 ? 'Done' : 'Failed';
    const error = result.exitCode === 0 ? '' : `Process exited with code ${result.exitCode}`;
    return store.updateTask(task.id, {
      status,
      finishedAt,
      processRef: result.processRef,
      output: result.stdout,
      log: [
        `Started session ${sessionRef}`,
        `Process reference ${result.processRef}`,
        `Command ${runner.command}`,
        result.stderr ? `stderr:\n${result.stderr}` : ''
      ].filter(Boolean).join('\n'),
      error
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await store.writeRunFile(runArtifactPath, 'error.log', error.stack ?? error.message);
    return store.updateTask(task.id, {
      status: 'Failed',
      finishedAt,
      output: '',
      log: `Started session ${sessionRef}\nFailed before completion`,
      error: error.message
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

export function buildRunnerCommand(task, runArtifactPath, options = {}) {
  const subagent = findSubagent(task.subagent);
  if (!subagent) {
    throw new Error(`Unknown subagent: ${task.subagent}`);
  }

  const command = options.command ?? process.env.CODEX_TASK_COMMAND ?? 'codex';
  const prompt = [
    `Subagent: ${subagent.role}`,
    `Task: ${task.title}`,
    '',
    task.description,
    task.notes ? `\nNotes:\n${task.notes}` : ''
  ].filter(Boolean).join('\n');

  if (options.args) {
    return {
      command,
      args: options.args,
      cwd: path.resolve(task.workspacePath),
      prompt,
      stdin: options.stdin,
      env: options.env ?? process.env
    };
  }

  return {
    command,
    args: ['exec', '--full-auto', '-'],
    cwd: path.resolve(task.workspacePath),
    prompt,
    stdin: prompt,
    env: options.env ?? process.env
  };
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
      resolve({ exitCode, stdout, stderr, processRef });
    });
  });
}
