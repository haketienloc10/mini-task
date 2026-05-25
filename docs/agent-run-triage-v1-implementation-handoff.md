# Implementation-Ready Handoff

## 1. Objective

Implement **Agent Run Triage v1** for `mini-task`: separate task lifecycle from run/session execution state, expose triage states on the board, and add a cockpit-style task detail header with evidence and next actions.

The result should let the user quickly answer: which task is running, which needs input, which failed/retryable, which is done with evidence, and what action should happen next.

## 2. Final Decision

Build a narrow Agent Work Cockpit slice, not a Kanban/project-management expansion.

Use `taskStatus` and `runStatus` as separate concepts. Treat retryability as a derived capability such as `canRetry`, not as a workflow status. Do not introduce a full verification model in this slice.

## 3. Implementation Scope

### In Scope

- Formalize `taskStatus` and `runStatus`.
- Preserve compatibility with existing `status` values where needed.
- Add a state matrix/helper for display state and allowed actions.
- Add `canRetry` as a derived property.
- Update board cards to show triage badges.
- Update task detail to show a cockpit header.
- Show existing evidence near the header/action area.
- Add or expose minimal next actions:
  - `Provide input` / `Resume`
  - `Retry`
  - `Open artifact` where available

### Out of Scope

- Drag-and-drop board behavior.
- Custom columns.
- Labels, priority, due dates, SLA, bulk actions.
- Full verification workflow.
- Persisted `evidenceSummary`.
- Workflow builder.
- New multi-run history UI beyond what is needed for current/latest run.

## 4. Current Context / Existing System Assumptions

- Existing task status values include `Assigned`, `Running`, `Done`, `Failed`.
- `src/taskStore.mjs` owns task creation/update/persistence.
- `src/runner.mjs` updates task run outcomes, `sessionRef`, `runArtifactPath`, `tokenUsage`, messages, and terminal events.
- `src/server.mjs` exposes task APIs and SSE.
- `public/app.js` renders board, task detail, chat, terminal, and SSE updates.
- `public/index.html` defines the board/detail shell.
- `public/styles.css` owns visual treatment.
- Existing tests cover server APIs, task dispatch, terminal events, and run artifacts.

## 5. Target Files / Areas To Inspect Or Modify

| Area | Expected Work |
|---|---|
| `src/taskStore.mjs` | Add/formalize persisted fields or compatibility mapping for `taskStatus` and `runStatus`; preserve old tasks. |
| `src/runner.mjs` | Update run lifecycle writes to set `runStatus` and corresponding `taskStatus` transitions. |
| `src/server.mjs` | Ensure API responses expose the new fields and actions can call the right run/task behavior. |
| `public/app.js` | Add derived display state, board badges, cockpit header, evidence display, and action visibility. |
| `public/index.html` | Add minimal structure if needed for cockpit header/actions. |
| `public/styles.css` | Style badges, cockpit header, evidence summary, and action affordances. |
| `tests/task-dispatch.test.mjs` | Cover runner/state transitions. |
| `tests/server-api.test.mjs` | Cover API compatibility, actions, and visible state data. |

## 6. Required Behavior

- When a task has no active run, it should have a task lifecycle state distinct from run execution state.
- When a run starts, `runStatus` should reflect running execution and task display should show running.
- When a run needs user input, the board/detail must show `needs_input` and expose `Provide input` / `Resume`.
- When a run fails and retry is possible, the board/detail must show retry affordance through derived `canRetry`.
- When a run completes successfully, the task can be `done`, but not automatically `verified`.
- When `runArtifactPath` exists, the UI should expose `Open artifact` or equivalent evidence access.
- Terminal events must be presented as operational evidence, not final output.

## 7. Data / State / Model Contract

Minimum conceptual contract:

- `taskStatus`: task lifecycle, for example `assigned | running | needs_input | failed | done | verified`
- `runStatus`: execution/session/run state, for example `idle | running | waiting_input | failed | completed`
- `canRetry`: derived boolean/action affordance, not workflow status

Suggested transition rules:

- `runStatus=running` can map display to `taskStatus=running`.
- `runStatus=waiting_input` maps task display to `needs_input`.
- `runStatus=completed` maps task to `done`, not `verified`.
- `runStatus=failed` maps task to `failed`; `canRetry` determines retry affordance.
- `verified` only comes from an explicit user/manual verification action if implemented.

Backward compatibility:

- Existing `status` values must still load.
- Existing tasks without `taskStatus` or `runStatus` should be normalized or rendered safely.

## 8. Action / Guard Rules

| Action | Enabled When | Disabled When | Result | Evidence |
|---|---|---|---|---|
| `Provide input` / `Resume` | Task/run is waiting for user input or has resumable session context | Run is actively running or no session/input path exists | Sends follow-up/resume input | Message appended, session/run context visible |
| `Retry` | `runStatus=failed` and `canRetry=true` | Running, no failure, or no retry context | Starts a new run/retry path | New run state, terminal events, artifact path |
| `Open artifact` | `runArtifactPath` exists | No artifact path | Opens or reveals artifact path | Artifact path visible |
| `Mark verified` | Task is done and a manual verification rule is implemented | No proof/manual rule | Marks task verified | Manual action/proof visible |

## 9. UI / UX Contract

- Board cards must show task status and run state without collapsing them into one ambiguous label.
- Board must visually distinguish at least:
  - running
  - needs input
  - failed
  - retryable
  - done
- Task detail must have a cockpit header near the top.
- Cockpit header must show:
  - task status
  - run state
  - session identity
  - agent/subagent if available
  - latest error or relevant event
  - artifact path if available
  - token usage if available
- Primary action must change based on current state.
- Terminal tab remains available, but the user should not need to inspect terminal first to know what to do next.

## 10. API / Backend Contract

- API task payloads should expose enough state for the UI to render `taskStatus`, `runStatus`, and `canRetry`.
- Backend should preserve existing run behavior and SSE behavior.
- Existing terminal SSE should continue to stream operational evidence.
- Existing task lifecycle SSE should still update board/detail consistently.
- Existing tasks missing new fields should not crash API or UI.

## 11. Execution Plan For Executor

1. Inspect current task shape in `src/taskStore.mjs`, `src/runner.mjs`, and API responses.
2. Define minimal state helpers/constants for `taskStatus`, `runStatus`, and `canRetry`.
3. Add backward-compatible normalization for existing tasks.
4. Update runner lifecycle writes to maintain the new state contract.
5. Update API responses if needed so UI receives the new fields.
6. Update `public/app.js` board rendering with triage badges and action affordances.
7. Add cockpit header in task detail with status, run state, evidence, and actions.
8. Add or update tests for state transitions and API compatibility.
9. Run validation commands and record evidence.

## 12. Acceptance Criteria

- [ ] Existing tasks with old `status` values still render.
- [ ] New/updated tasks expose separate task lifecycle and run execution state.
- [ ] Board shows clear triage badges for running, needs input, failed/retryable, and done.
- [ ] Task detail shows cockpit header before deep terminal inspection.
- [ ] `canRetry` is derived consistently in one place.
- [ ] `Done` does not automatically imply `Verified`.
- [ ] Terminal events remain operational evidence.
- [ ] Tests cover assigned/no run, running, needs input, failed retryable, and done with artifact.

## 13. Required Tests / Validation

| Validation | Purpose |
|---|---|
| `npm test` | Run existing test suite. |
| `tests/task-dispatch.test.mjs` updates | Verify runner/state transitions. |
| `tests/server-api.test.mjs` updates | Verify API payload compatibility and action/state behavior. |
| Manual browser check | Verify board badges, cockpit header, evidence, and next actions render correctly. |

## 14. Regression Risks

- Existing tasks fail to load due to missing new fields.
- Current board columns break if status mapping changes too aggressively.
- SSE updates no longer refresh task state correctly.
- Retry/resume actions become enabled in unsafe states.
- Terminal evidence becomes visually confused with final artifact/output.

## 15. Evidence Executor Must Provide

After implementation, executor should report:

- Files changed
- State contract implemented
- Compatibility behavior for old tasks
- Tests run and results
- Manual UI evidence for board/detail states
- Known limitations or deferred verification behavior

## 16. Do Not Do

- Do not add drag-and-drop Kanban.
- Do not add labels, priorities, due dates, or SLA.
- Do not introduce full verification workflow unless explicitly requested.
- Do not create persisted `evidenceSummary` in v1.
- Do not treat terminal log as final output.
- Do not make `retryable` a workflow status.
