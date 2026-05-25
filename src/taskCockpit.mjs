const NEEDS_INPUT_REASONS = new Set(['manual', 'agent_requested_input', 'blocked']);
const VERIFICATION_STATES = new Set(['unknown', 'evidence_missing', 'evidence_present', 'verified']);

export function normalizeStoredTask(task) {
  const normalized = {
    ...task,
    needsInput: normalizeNeedsInput(task.needsInput),
    verificationState: normalizeVerificationState(task.verificationState)
  };
  return normalized;
}

export function normalizeNeedsInput(value) {
  const active = value?.active === true;
  const reason = NEEDS_INPUT_REASONS.has(value?.reason) ? value.reason : 'manual';
  return {
    active,
    reason,
    message: typeof value?.message === 'string' ? value.message : '',
    createdAt: typeof value?.createdAt === 'string' ? value.createdAt : null
  };
}

export function normalizeVerificationState(value) {
  return VERIFICATION_STATES.has(value) ? value : 'unknown';
}

export function enrichTask(task) {
  const normalized = normalizeStoredTask(task);
  const evidenceSummary = deriveEvidenceSummary(normalized);
  return {
    ...normalized,
    workflowState: deriveWorkflowState(normalized),
    runnerState: deriveRunnerState(normalized),
    actions: deriveActions(normalized),
    evidenceSummary
  };
}

export function deriveEvidenceSummary(task) {
  const hasRunArtifact = Boolean(task.runArtifactPath);
  const hasTerminalEvents = Array.isArray(task.terminalEvents) && task.terminalEvents.length > 0;
  const hasAgentMessage = Array.isArray(task.messages)
    && task.messages.some((message) => message.sender === 'agent' || message.sender === 'assistant');
  const hasOutput = Boolean(task.output?.trim());
  const hasError = Boolean(task.error?.trim());
  const hasEvidence = hasRunArtifact || hasTerminalEvents || hasAgentMessage || hasOutput || hasError;
  const storedState = normalizeVerificationState(task.verificationState);
  const state = storedState === 'verified'
    ? 'verified'
    : task.status === 'Done'
      ? (hasEvidence ? 'evidence_present' : 'evidence_missing')
      : storedState;

  return {
    state,
    hasRunArtifact,
    hasTerminalEvents,
    hasAgentMessage,
    hasOutput,
    hasError,
    artifactPath: task.runArtifactPath ?? null,
    error: task.error ?? ''
  };
}

function deriveWorkflowState(task) {
  if (task.needsInput?.active) return 'needs_input';
  if (task.status === 'Running') return 'running';
  if (task.status === 'Failed') return 'failed';
  if (task.status === 'Done') return 'done';
  return 'queued';
}

function deriveRunnerState(task) {
  if (task.status === 'Running') return 'running';
  if (task.status === 'Failed') return 'error';
  if (task.finishedAt || task.processRef || task.runArtifactPath) return 'exited';
  return 'idle';
}

function deriveActions(task) {
  const isRunning = task.status === 'Running';
  const hasSession = Boolean(task.sessionRef);
  return {
    canStart: task.status === 'Assigned' && !isRunning,
    canResume: hasSession && !isRunning,
    canRetry: task.status === 'Failed' && !isRunning,
    canFollowUp: hasSession && !isRunning,
    canMarkNeedsInput: !isRunning,
    canClearNeedsInput: task.needsInput?.active === true
  };
}
