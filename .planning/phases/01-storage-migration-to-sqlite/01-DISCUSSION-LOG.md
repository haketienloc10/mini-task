# Phase 1: Storage Migration to SQLite - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 1-Storage Migration to SQLite
**Areas discussed:** Schema for Terminal Events, Existing Data Migration, SQLite Concurrency Mode

---

## Schema for Terminal Events

| Option | Description | Selected |
|--------|-------------|----------|
| Separate table (task_events) | avoids parsing large JSON blocks, solves memory blowup | ✓ |
| JSON array in tasks table | simpler migration, but keeps parsing overhead | |
| You decide | do whatever's best for performance | |

**User's choice:** (Recommended) Separate table (task_events) — avoids parsing large JSON blocks, solves memory blowup
**Notes:** 

| Option | Description | Selected |
|--------|-------------|----------|
| Stream/Paginate events | fetch in chunks to avoid memory blowup on large tasks | ✓ |
| Fetch all events at once | simpler, but risks memory issues for long tasks | |
| You decide | optimize for SSE requirements | |

**User's choice:** (Recommended) Stream/Paginate events — fetch in chunks to avoid memory blowup on large tasks
**Notes:** 

| Option | Description | Selected |
|--------|-------------|----------|
| JSON column for metadata | keeps schema flexible for different agent tasks | ✓ |
| Strictly normalize all fields | better queryability but rigid schema | |
| You decide | | |

**User's choice:** (Recommended) JSON column for metadata — keeps schema flexible for different agent tasks
**Notes:** 

---

## Existing Data Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Write a migration script | imports existing data on startup if SQLite is empty | ✓ |
| Start fresh | ignore existing JSON data, simpler implementation | |
| You decide | | |

**User's choice:** (Recommended) Write a migration script — imports existing data on startup if SQLite is empty
**Notes:** 

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to .bak | preserves data just in case migration fails or we need rollback | ✓ |
| Delete them immediately | keeps the data directory clean | |
| Leave them alone | harmless if we just stop reading/writing | |
| You decide | | |

**User's choice:** (Recommended) Rename to .bak — preserves data just in case migration fails or we need rollback
**Notes:** 

---

## SQLite Concurrency Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Enable WAL mode | better concurrency for task workers writing logs while SSE reads | ✓ |
| Use default journal mode | simpler, might be sufficient | |
| You decide | | |

**User's choice:** (Recommended) Enable WAL mode — better concurrency for task workers writing logs while SSE reads
**Notes:** 

---

## the agent's Discretion

None

## Deferred Ideas

None
