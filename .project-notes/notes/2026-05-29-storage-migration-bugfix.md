---
id: 2026-05-29-storage-migration-bugfix
type: continuity
task: storage-migration-bugfix
created_at: 2026-05-29
signal: Fixed hanging tests caused by unclosed DB connections and cancelled EventSource streams in SQLite migration.
areas:
- src/taskStore.mjs
- src/taskWorker.mjs
- tests/server-api.test.mjs
- tests/cockpit-e2e.test.mjs
decisions:
- "Added `close()` method to TaskStore to properly terminate SQLite database connections"
- "Updated taskWorker to explicitly close the store and exit to prevent zombie processes"
- "Relaxed the stream running events assertion length to account for the new internal worker `updateTask` events"
invariants:
- "TaskStore must explicitly be closed to avoid test hangs and file lock issues"
- "Terminal stream consumers must properly cancel `response.body.getReader()` to free HTTP connections"
risks:
- "Node.js tests may hang if there are any other unaccounted DB or network connection leaks."
tests:
- "npm test successfully executes and validates the fixes."
missing_tests: []
supersedes: []
---

## task
storage-migration-bugfix — 2026-05-29

## deviations
The original storage migration phase was complete, but introduced hanging handles (SQLite and SSE) that caused test runner instability.

## traps
- `better-sqlite3` requires explicit closure or the Node.js process stays alive.
- EventSource reader in tests without `reader.cancel()` prevents HTTP connections from terminating, blocking the HTTP server from fully shutting down.

## dead_ends
None

## validation_delta
As expected, all tests now successfully pass and the test suite gracefully terminates.

## next_agent_hint
See Handoff
