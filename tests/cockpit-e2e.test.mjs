import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createServer } from '../src/server.mjs';
import { TaskStore } from '../src/taskStore.mjs';

async function createCodexAgents(root, names) {
  const homeCodexDir = path.join(root, 'home-codex');
  for (const name of names) {
    const agentDir = path.join(homeCodexDir, name, 'agents');
    await mkdir(agentDir, { recursive: true });
    await writeFile(path.join(agentDir, 'openai.yaml'), [
      'interface:',
      `  display_name: "${name}"`,
      `  short_description: "${name} test agent"`,
      `  default_prompt: "harness_${name}"`
    ].join('\n'), 'utf8');
  }
  return homeCodexDir;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Non-json response from ${url}: ${response.status} - ${text}`);
  }
  if (!response.ok) {
    throw { status: response.status, error: json.error ?? text };
  }
  return json;
}

test('E2E Cockpit Workflow and Action Guards', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'codex-task-dispatch-e2e-'));
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
    // 1. Create project
    const project = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E Project', description: 'Verification', workspacePath: workspace })
    });

    // 2. Create task and verify initial state
    let task = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: project.id,
        title: 'E2E Cockpit Task',
        description: 'Verify state transitions and actions',
        subagent: 'generator',
        notes: 'initial notes'
      })
    });
    
    assert.equal(task.status, 'Assigned');
    assert.equal(task.workflowState, 'queued');
    assert.equal(task.runnerState, 'idle');
    assert.equal(task.needsInput.active, false);
    assert.equal(task.actions.canStart, true);
    assert.equal(task.actions.canResume, false);
    assert.equal(task.actions.canRetry, false);
    assert.equal(task.actions.canFollowUp, false);
    assert.equal(task.actions.canMarkNeedsInput, true);
    assert.equal(task.actions.canClearNeedsInput, false);
    assert.equal(task.evidenceSummary.state, 'unknown');

    // 3. Mark Needs Input manually
    task = await request(`${baseUrl}/api/tasks/${task.id}/needs-input`, {
      method: 'PATCH',
      body: JSON.stringify({ active: true, message: 'Clarify workspace path' })
    });

    assert.equal(task.workflowState, 'needs_input');
    assert.equal(task.needsInput.active, true);
    assert.equal(task.needsInput.message, 'Clarify workspace path');
    assert.equal(task.actions.canStart, true);
    assert.equal(task.actions.canMarkNeedsInput, true);
    assert.equal(task.actions.canClearNeedsInput, true);

    // 4. Clear Needs Input
    task = await request(`${baseUrl}/api/tasks/${task.id}/needs-input`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false })
    });

    assert.equal(task.workflowState, 'queued');
    assert.equal(task.needsInput.active, false);
    assert.equal(task.actions.canClearNeedsInput, false);

    // 5. Run the task
    const runningTask = await request(`${baseUrl}/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'start' })
    });

    assert.equal(runningTask.status, 'Running');
    assert.equal(runningTask.workflowState, 'running');
    assert.equal(runningTask.runnerState, 'running');
    assert.equal(runningTask.actions.canStart, false);
    assert.equal(runningTask.actions.canResume, false);
    assert.equal(runningTask.actions.canRetry, false);
    assert.equal(runningTask.actions.canFollowUp, false);
    assert.equal(runningTask.actions.canMarkNeedsInput, false);
    assert.equal(runningTask.actions.canClearNeedsInput, false);

    // 6. Verify run guards (double-run reject)
    await assert.rejects(
      request(`${baseUrl}/api/tasks/${task.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'start' })
      }),
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.error, /Task cannot be started in its current state/);
        return true;
      }
    );

    // 7. Verify needs-input patch rejected while running
    await assert.rejects(
      request(`${baseUrl}/api/tasks/${task.id}/needs-input`, {
        method: 'PATCH',
        body: JSON.stringify({ active: true, message: 'Reject me' })
      }),
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.error, /Cannot mark a running task as needing input/);
        return true;
      }
    );

    // 8. Wait for task to finish and check completion state
    let completedTask;
    for (let i = 0; i < 20; i++) {
      await delay(200);
      completedTask = await request(`${baseUrl}/api/tasks/${task.id}`);
      if (completedTask.status === 'Done') break;
    }

    assert.equal(completedTask.status, 'Done');
    assert.equal(completedTask.workflowState, 'done');
    assert.equal(completedTask.runnerState, 'exited');
    assert.ok(completedTask.sessionRef);
    assert.equal(completedTask.actions.canStart, false);
    assert.equal(completedTask.actions.canResume, true);
    assert.equal(completedTask.actions.canFollowUp, true);
    assert.equal(completedTask.actions.canRetry, false);
    assert.equal(completedTask.evidenceSummary.state, 'evidence_present');

    // 9. Send follow-up
    const resumeTask = await request(`${baseUrl}/api/tasks/${task.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'followup', prompt: 'Next question' })
    });
    assert.equal(resumeTask.status, 'Running');
    assert.equal(resumeTask.sessionRef, completedTask.sessionRef);

    // Wait to finish again
    for (let i = 0; i < 20; i++) {
      await delay(200);
      completedTask = await request(`${baseUrl}/api/tasks/${task.id}`);
      if (completedTask.status === 'Done') break;
    }

    // 10. Trigger failure task via invalid workspace path
    const failProject = await request(`${baseUrl}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Fail Project', description: 'Triggers invalid workspace path', workspacePath: '/non-existent-directory-xyz' })
    });
    
    let failTask = await request(`${baseUrl}/api/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        projectId: failProject.id,
        title: 'Fail Task',
        description: 'Should fail because of invalid workspace path',
        subagent: 'generator',
        notes: 'fail'
      })
    });
    
    await request(`${baseUrl}/api/tasks/${failTask.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'start' })
    });

    for (let i = 0; i < 20; i++) {
      await delay(200);
      failTask = await request(`${baseUrl}/api/tasks/${failTask.id}`);
      if (failTask.status === 'Failed') break;
    }

    assert.equal(failTask.status, 'Failed');
    assert.equal(failTask.workflowState, 'failed');
    assert.equal(failTask.runnerState, 'error');
    assert.equal(failTask.actions.canStart, false);
    assert.equal(failTask.actions.canRetry, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
