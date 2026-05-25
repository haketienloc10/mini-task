# Agent Work Cockpit - Party Mode Handoff

## Decision Summary

`mini-task` should move toward an **Agent Work Cockpit**: a task board tied directly to Codex/agent sessions, runs, evidence, and follow-up actions.

The agreed MVP direction is the cockpit loop:

```text
scan -> inspect -> act -> verify
```

The board is only the scan/attention surface. The task detail view is the main cockpit for session/run context, evidence, and safe next actions.

## Scope

### In Scope

- Separate `taskStatus` from `runStatus`.
- Show agent-work-oriented task states on the board.
- Use task detail as the control surface for one task/session/run.
- Show current/latest run context.
- Show minimal run history.
- Show evidence summary before raw terminal/log detail.
- Provide first-class continuation/recovery actions.
- Keep terminal/log output as evidence, not the main product surface.

### MVP States

- `running`
- `needs_input`
- `blocked`
- `failed`
- `retryable`
- `done`
- `verified`

### MVP Actions

- `resume`
- `retry`
- `follow_up`
- `view_evidence`

`mark_verified` should be included in the action guard matrix if `verified` is part of MVP behavior.

## Out of Scope

- Generic Kanban customization.
- Drag/drop workflow.
- Saved views and advanced filters.
- Bulk actions.
- Full timeline visualization.
- Full terminal emulator.
- Complex automatic log classification.
- General-purpose state machine or workflow engine.
- Dashboard analytics or productivity metrics.
- Multi-user collaboration.
- Notification, permission, or Jira/Trello-style project management features.

## Requirements Confirmed

- `taskStatus` represents workflow state from the user's point of view.
- `runStatus` represents execution/session/run state.
- `done` and `verified` must remain distinct.
- Board must consume normalized state, not parse terminal logs directly.
- Evidence must trace back to a specific run/session.
- Task detail should answer: what is happening, why, and what can I safely do next?
- Raw terminal/log output should be drill-down evidence, not the default decision surface.
- Actions must be enabled/disabled by explicit guard rules, not ad hoc UI logic.
- Multiple runs per task must be modeled and tested.
- Stale or missing evidence must have an explicit fallback state/label.

## Technical Notes

Start with a light state/action contract before building a large UI.

Minimum model areas:

- `taskStatus`
- `runStatus`
- `sessionRef`
- `runId`
- run timestamps
- run summary/error
- `runArtifactPath`
- token usage when available
- latest message or input request when available
- evidence source and freshness
- `availableActions`

Implementation should avoid deriving workflow status from raw terminal text in MVP. Terminal events can explain or support a decision, but strong workflow status should come from structured run/session/task state.

## UX Notes

- Board should show `taskStatus` as the primary signal.
- `runStatus` should be secondary metadata.
- Each board item should prefer one clear next action over many controls.
- Task detail should open with a decision header:
  - current task state
  - why it is in that state
  - what the user can do next
- Evidence summary should show source and freshness.
- Raw logs should be inspectable but not visually dominant.

## QA / Acceptance Notes

Acceptance should prove that the cockpit reduces context hunting.

Minimum acceptance conditions:

- User opens board and sees which tasks need attention.
- User sees a short reason/evidence for important states.
- User opens task detail and can identify the correct next action.
- User can distinguish task workflow status from run/session status.
- `resume`, `retry`, `follow_up`, and `view_evidence` appear only when allowed.
- `done` does not imply `verified`.
- Evidence/logs can be traced to a specific run/session.
- Reload does not lose minimal cockpit context.

Required test scenarios:

- `done` vs `verified`.
- Multiple runs on one task.
- Failed run followed by retry.
- Run failed but task remains `retryable`.
- Task is `needs_input`.
- Stale or missing evidence.
- Action disabled with an understandable reason.
- Latest run succeeds while an earlier run failed.

## Risks

- UI may look correct while behavior remains untestable if `taskStatus` and `runStatus` are not separated first.
- Parsing terminal logs for workflow status can become expensive and unreliable.
- Board can become too noisy if it exposes every run/evidence detail.
- Multiple runs can overwrite or confuse task state without precedence rules.
- `failed`, `blocked`, `needs_input`, and `retryable` can overlap without clear definitions.
- User trust can drop if inferred status lacks source/evidence/freshness.

## Open Questions

- How detailed should MVP transition rules be before implementation?
- What is the precedence rule when `taskStatus`, `runStatus`, and evidence conflict?
- Should `blocked` and `failed` be separate board states, or grouped on board and separated in detail?
- How much evidence confidence/source/freshness should be visible in MVP?
- Should `mark_verified` be a first-class MVP action or only a later manual workflow action?

## Recommended Next Step

Create a small state/action contract before UI implementation:

1. Define `taskStatus` and `runStatus`.
2. Define state transition rules for MVP states.
3. Define evidence sources and freshness rules.
4. Define multiple-run precedence rules.
5. Define action eligibility for `resume`, `retry`, `follow_up`, `view_evidence`, and possibly `mark_verified`.
6. Then wire board/detail UI to this contract.
