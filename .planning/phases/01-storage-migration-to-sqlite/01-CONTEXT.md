# Phase 1: Storage Migration to SQLite - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace `tasks.json` and `projects.json` with a SQLite database to resolve I/O bottlenecks, lock contention, and unbounded memory consumption.

</domain>

<decisions>
## Implementation Decisions

### Schema for Terminal Events
- **D-01:** Separate table (task_events) — avoids parsing large JSON blocks, solves memory blowup.
- **D-02:** Stream/Paginate events — fetch in chunks to avoid memory blowup on large tasks.
- **D-03:** JSON column for metadata — keeps schema flexible for different agent tasks.

### Existing Data Migration
- **D-04:** Write a migration script — imports existing data on startup if SQLite is empty.
- **D-05:** Rename to .bak — preserves data just in case migration fails or we need rollback.

### SQLite Concurrency Mode
- **D-06:** Enable WAL mode — better concurrency for task workers writing logs while SSE reads.

### the agent's Discretion
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Storage Implementation
- `src/taskStore.mjs` — The module that needs to be rewritten to use `better-sqlite3`.

### Real-Time Updates
- `src/server.mjs` — The API server using SSE which relies on the storage mechanism.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None specifically.

### Established Patterns
- File-based locks: Current mechanism (`tasks.json.lock`) to be replaced entirely by SQLite WAL.
- Long-running detatched workers (`src/taskWorker.mjs`) emitting events.

### Integration Points
- `src/server.mjs`: API and SSE endpoints that currently read from `src/taskStore.mjs`.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-Storage Migration to SQLite*
*Context gathered: 2026-05-29*
