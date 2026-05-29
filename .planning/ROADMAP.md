# Project Roadmap

## Phase 1: Storage Migration to SQLite
- **Goal:** Replace `tasks.json` and `projects.json` with a SQLite database to resolve I/O bottlenecks and lock contention.
- **Key Deliverables:** 
  - Install `better-sqlite3`.
  - Rewrite `src/taskStore.mjs` to use SQLite.
  - Ensure all existing storage tests pass (or update them).

## Phase 2: Event-Driven SSE and Performance Fixes
- **Goal:** Remove the aggressive 250ms polling loop and replace it with an Event Emitter architecture.
- **Key Deliverables:**
  - Implement Node.js Event Emitter in `TaskStore`.
  - Refactor `src/server.mjs` SSE endpoints to subscribe to events instead of polling.
  - Test real-time updates from frontend to ensure responsiveness.

## Phase 3: Memory Optimization and YAML Parser
- **Goal:** Fix memory leaks in process execution and integrate a robust YAML parser.
- **Key Deliverables:**
  - Update `src/runner.mjs` to bound/stream process output instead of holding all stdout/stderr in memory.
  - Install `js-yaml` and replace regex parser in `src/subagents.mjs`.

## Phase 4: Security and Cleanup (Optional)
- **Goal:** Address remaining concerns like zombie processes and input validation.
- **Key Deliverables:**
  - Improve process lifecycle management to accurately detect zombie processes.
  - Add basic input validation on API endpoints to prevent Command Injection.
