# Implementation-Ready Handoff

## 1. Objective

Implement v1 **Agent Work Cockpit** slice for `mini-task`: make `Needs Input`, `Resume`/`Retry`/`Follow-up`, and `Evidence Summary` first-class in task detail and visible enough on the board.

This is not a Kanban/status migration. Keep the existing board/status model stable while adding a thin cockpit state/action layer.

## 2. Final Decision

Use **Option B** from party convergence:

- Keep board columns/status enum as-is.
- Add `Needs Input` as first-class signal via badge/pin/filter/detail banner.
- Add server-derived `workflowState`, `runnerState`, `actions`, and `evidenceSummary`.
- Add minimal stored manual fields: `needsInput`, `verificationState`.
- Add explicit run modes to `/api/tasks/:id/run`.

Readiness review result: BA, PO, Technical Lead, and QA all approved with minor implementation notes.

## 3. Implementation Scope

### In Scope

- Preserve existing `status`: `Assigned | Running | Done | Failed | Cancelled`.
- Add/normalize stored task fields:
  - `needsInput`
  - `verificationState`
- Enrich task API responses with:
  - `workflowState`
  - `runnerState`
  - `actions`
  - `evidenceSummary`
- Support `POST /api/tasks/:id/run` body:
  - `mode: "start" | "resume" | "retry" | "followup"`
  - `prompt?: string`
- Keep backward compatibility with current `{ prompt }` behavior.
- Add `PATCH /api/tasks/:id/needs-input` for manual set/clear.
- Update board cards with Needs Input / retry / evidence badges.
- Update task detail overview with cockpit summary and primary actions.

### Out of Scope

- New board column for `Needs Input`.
- Drag/drop Kanban.
- Full workflow engine or transition matrix.
- Auto-detect Needs Input from free-form logs/NLP.
- Full verification workflow.
- Multi-user/auth/permissions.
- Rich run history browser or run diff.

## 4. Current Context / Existing System Assumptions

- `src/taskStore.mjs` is JSON-backed source of persisted projects/tasks.
- `src/server.mjs` owns task/project APIs, task SSE, terminal SSE, and `/api/tasks/:id/run`.
- `src/runner.mjs` runs Codex, stores artifacts/events/messages, and updates `status`.
- `public/app.js` renders board columns from `BOARD_STATUSES = ['Assigned', 'Running', 'Done', 'Failed']`.
- Existing task fields include `sessionRef`, `processRef`, `runArtifactPath`, `output`, `log`, `error`, `tokenUsage`, `terminalEvents`, `messages`.

## 5. Target Files / Areas To Inspect Or Modify

| Area | Expected Work |
|---|---|
| `src/taskStore.mjs` | Default/migrate legacy tasks with new fields; validate stored values. |
| `src/server.mjs` | Enrich task responses; add `/run` modes; add `PATCH /needs-input`; guard actions. |
| `src/runner.mjs` | Preserve runner behavior; ensure start/finish updates cooperate with new state fields. |
| `public/app.js` | Render board badges/filter/pin, cockpit overview, actions, evidence summary. |
| `public/index.html` | Add controls/containers only if current DOM lacks anchors. |
| `public/styles.css` | Style badges, cockpit summary, action controls, empty/error states. |
| `tests/server-api.test.mjs` | API/action/evidence/legacy coverage. |
| `tests/task-dispatch.test.mjs` | Runner/run mode compatibility if needed. |

## 6. Required Behavior

- When a task has `needsInput.active === true`, API `workflowState` must be `needs_input`.
- When a task is `Running`, no start/resume/retry/followup action may create a second active run.
- When a task has `sessionRef` and is not running, `Resume`/`Follow-up` availability must be derived server-side.
- When a task is `Failed`, `Retry` must be available unless it is currently running.
- When a task is `Done` but lacks evidence, UI must show `Missing evidence`, not imply verified.
- Board must keep existing columns but surface `Needs Input` clearly through badge and prioritization/filter.
- Detail overview must answer: current state, next action, session/run context, evidence status.

## 7. Data / State / Model Contract

Stored fields:

```js
needsInput: {
  active: boolean,
  reason: "manual" | "agent_requested_input" | "blocked",
  message: string,
  createdAt: string | null
}

verificationState:
  "unknown" | "evidence_missing" | "evidence_present" | "verified"
```

Derived response fields:

```js
workflowState:
  "queued" | "running" | "needs_input" | "failed" | "done"

runnerState:
  "idle" | "running" | "exited" | "error"

actions: {
  canStart: boolean,
  canResume: boolean,
  canRetry: boolean,
  canFollowUp: boolean,
  canMarkNeedsInput: boolean,
  canClearNeedsInput: boolean
}

evidenceSummary: {
  state: "unknown" | "evidence_missing" | "evidence_present" | "verified",
  hasRunArtifact: boolean,
  hasTerminalEvents: boolean,
  hasAgentMessage: boolean,
  hasOutput: boolean,
  hasError: boolean,
  artifactPath: string | null,
  error: string
}
```

Rules:

- `status` remains compatibility/source for legacy board columns.
- `needsInput.active=true` takes precedence for `workflowState=needs_input`.
- `Assigned -> queued`.
- `Running -> running`.
- `Failed -> failed`, unless `needsInput.active=true`.
- `Done -> done`, unless `needsInput.active=true`.
- Evidence from `messages` should count only assistant/agent messages, not user-only prompts.
- `verificationState` defaults server-side if missing:
  - `Done` + evidence present -> `evidence_present`
  - `Done` + no evidence -> `evidence_missing`
  - otherwise `unknown`
- `verified` is not auto-set by runner.

## 8. Action / Guard Rules

| Action | Enabled When | Disabled When | Result | Evidence |
|---|---|---|---|---|
| `Start` | `status=Assigned`, not running | running | Calls `/run` with `mode:"start"` | task becomes `Running`, SSE update |
| `Resume` | has `sessionRef`, not running | no `sessionRef` or running | Calls `/run` with `mode:"resume"` | command uses existing session |
| `Retry` | `status=Failed`, not running | running | Calls `/run` with `mode:"retry"`; new run, do not depend on old session | new run artifact/events |
| `Follow-up` | has `sessionRef`, not running, prompt present | no `sessionRef` or running | Calls `/run` with `mode:"followup"` + `prompt` | user message appended |
| `Mark Needs Input` | not running | running | `PATCH /needs-input` active true | badge/detail banner |
| `Clear Needs Input` | `needsInput.active=true` | otherwise | `PATCH /needs-input` active false | badge removed |

## 9. UI / UX Contract

- Board columns remain `Assigned`, `Running`, `Done`, `Failed`.
- Task cards show compact badges:
  - `Needs input`
  - `Retryable`
  - `Missing evidence`
  - `Evidence present`
- Needs Input tasks should be pinned/sorted to top within their existing column if simple.
- Add a board filter/toggle for `Needs Input` if feasible without broad refactor.
- Detail overview must include:
  - workflow/triage state
  - runner/session state
  - evidence summary
  - next action block
  - primary buttons: `Resume session`, `Retry run`, `Send follow-up`
- Empty states:
  - terminal: `No terminal output for this run.`
  - messages: `No chat messages yet.`
  - evidence: `No evidence artifact recorded.`

## 10. API / Backend Contract

`GET /api/tasks` and `GET /api/tasks/:id` must return enriched task objects with derived fields.

`POST /api/tasks/:id/run`:

```js
{
  mode: "start" | "resume" | "retry" | "followup",
  prompt: "optional"
}
```

Compatibility:

- Existing `{ prompt }` without `mode` behaves as:
  - `followup` if task has `sessionRef`
  - otherwise `start`
- Existing empty body still starts/reruns according to current behavior where valid.

Add:

```http
PATCH /api/tasks/:id/needs-input
```

Set:

```js
{ active: true, reason: "manual", message: "Need user clarification" }
```

Clear:

```js
{ active: false }
```

## 11. Execution Plan For Executor

1. Run GitNexus impact analysis before editing touched symbols, per repo rules.
2. Add normalization/derivation helpers for task cockpit state.
3. Add default handling for legacy tasks missing `needsInput` and `verificationState`.
4. Enrich `GET /api/tasks` and `GET /api/tasks/:id`.
5. Add `PATCH /api/tasks/:id/needs-input`.
6. Extend `/run` to support `mode` with backward compatibility and running guards.
7. Update UI board badges/filter/pin and task detail cockpit overview/actions.
8. Add API/unit tests for fixtures and guards.
9. Run `npm test` and `npm run build`.
10. Provide evidence: changed files, tests, API examples, UI screenshots/manual notes.

## 12. Acceptance Criteria

- [ ] Legacy tasks without new fields still load and render.
- [ ] Board columns remain unchanged.
- [ ] Needs Input appears clearly on board and detail.
- [ ] Running task disables start/resume/retry/follow-up and server rejects double-run.
- [ ] Failed task exposes Retry.
- [ ] Task with `sessionRef` exposes Resume/Follow-up when not running.
- [ ] Done task with no evidence shows Missing evidence.
- [ ] API responses include `workflowState`, `runnerState`, `actions`, `evidenceSummary`.
- [ ] `/run` supports explicit modes and old `{ prompt }` behavior.
- [ ] `PATCH /needs-input` set/clear updates persisted state and SSE/UI.

## 13. Required Tests / Validation

| Validation | Purpose |
|---|---|
| `npm test` | Full existing and new test suite. |
| `npm run build` | Static asset sanity check. |
| API fixture: `assigned_never_run` | Defaults/actions/evidence empty. |
| API fixture: `running_with_process` | Running guard and action disabled. |
| API fixture: `needs_input_with_session` | Needs Input workflow and clear action. |
| API fixture: `failed_retryable_with_error` | Retry/action/evidence error. |
| API fixture: `done_verified` | Evidence present. |
| API fixture: `done_missing_evidence` | Missing evidence. |
| API fixture: `legacy_task_missing_new_fields` | Backward compatibility. |
| Manual UI check | Board badges/filter/detail actions/evidence summary. |

## 14. Regression Risks

- Accidentally using `status` as the new workflow source of truth.
- Creating double runs for the same task.
- Breaking existing follow-up behavior through `/run`.
- Counting user-only messages as evidence.
- Losing old `terminalEvents`, `messages`, or `runArtifactPath`.
- SSE updates missing derived state changes.
- UI hiding Needs Input inside an old status badge.

## 15. Evidence Executor Must Provide

- Files changed.
- Summary of behavior implemented.
- `npm test` result.
- `npm run build` result.
- Example enriched `GET /api/tasks/:id` response.
- Example `PATCH /needs-input` set/clear response.
- UI screenshots or concise manual evidence for:
  - Assigned/no run
  - Running
  - Needs Input
  - Failed retryable
  - Done missing evidence

## 16. Do Not Do

- Do not add a `Needs Input` board column in v1.
- Do not change the persisted `status` enum.
- Do not implement auto Needs Input detection from arbitrary logs.
- Do not build full workflow/verification engine.
- Do not rewrite runner/session architecture.
- Do not put action-availability logic only in `public/app.js`; derive it server-side.
