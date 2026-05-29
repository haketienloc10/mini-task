# Phase 3: Memory Optimization and YAML Parser - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix memory/performance pressure in process execution and terminal event handling, and replace the fragile regex YAML metadata parser with `js-yaml`.

</domain>

<decisions>
## Implementation Decisions

### Output Memory
- **D-01:** Keep full `stdout.log` and `stderr.log` in run artifacts for audit/debug history, but keep only bounded output in memory/UI/task result fields.
- **D-02:** Use a tail window per stream for in-memory `stdout` and `stderr`; do not keep unbounded strings in `executeProcess()`.
- **D-03:** Use a default in-memory limit of 1 MiB per stream.
- **D-04:** For Codex `--json`, parse JSON events incrementally while streaming so `sessionRef`, `finalMessage`, and `tokenUsage` do not require full raw stdout in memory.

### Terminal Event Pressure
- **D-05:** Phase 3 should also fix `TaskStore.appendTerminalEvent()` pressure, not only `runner.mjs` output buffers.
- **D-06:** `appendTerminalEvent()` should return updated task metadata without hydrating `terminalEvents`; terminal SSE already receives the appended event separately.
- **D-07:** Separate terminal event reads from task reads and apply limits. `listTasks()` must not load full terminal event history.
- **D-08:** Default terminal history hydrate/replay should return the latest 1,000 events.
- **D-09:** Expose truncation metadata such as `terminalEventsTruncated` and/or `terminalEventCount` so API/UI consumers know a response is a tail, not full history.

### YAML Parser
- **D-10:** Use `js-yaml` but preserve the current flattened metadata lookup behavior for `interface.display_name`, `interface.short_description`, `interface.default_prompt`, plus existing top-level fallbacks.
- **D-11:** Invalid YAML agent files should be skipped silently as today; one broken agent file must not make `/api/subagents` fail.
- **D-12:** Keep metadata string-only. `js-yaml` may parse lists, objects, numbers, and booleans, but only string values should become agent metadata fields.
- **D-13:** Add targeted parser compatibility tests covering nested interface fields, top-level fallback, multiline string support, list values ignored, and invalid YAML skipped.

### the agent's Discretion
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/ROADMAP.md` — Phase 3 goal and deliverables.
- `.planning/REQUIREMENTS.md` — Acceptance criteria for output streaming/memory optimization and robust configuration parsing.
- `.planning/PROJECT.md` — Project stack and local-first/minimalism constraints.
- `.planning/codebase/CONCERNS.md` — Original technical debt notes for unbounded process output and regex YAML parsing.
- `.planning/phases/01-storage-migration-to-sqlite/01-CONTEXT.md` — Prior locked decisions for separate `task_events` storage and stream/paginated terminal events.

### Runtime and Storage Code
- `src/runner.mjs` — Process execution, stdout/stderr capture, Codex JSON parsing, run artifact writes.
- `src/taskStore.mjs` — SQLite task/event storage, `appendTerminalEvent()`, task reads, terminal event hydration.
- `src/server.mjs` — SSE terminal replay and API task read integration points.

### Agent Metadata Parsing
- `src/subagents.mjs` — Current regex YAML parser and flattened metadata lookup.
- `package.json` — Dependency list; `js-yaml` must be added here.

### Tests
- `tests/task-dispatch.test.mjs` — Runner, TaskStore, migration, and subagent fixture coverage.
- `tests/server-api.test.mjs` — API/SSE/subagent endpoint behavior and terminal stream expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TaskStore` already stores terminal events in a separate `task_events` table; Phase 3 can optimize reads/writes without reworking the schema.
- `executeProcess()` already centralizes child-process stdout/stderr handling and terminal event emission.
- `parseCodexJsonOutput()` already contains the event interpretation rules that can be adapted to incremental parsing.

### Established Patterns
- Node.js ESM modules, native `node --test`, and minimal dependencies.
- `TaskStore` emits `terminal` events separately from `task-updated`, so terminal SSE does not need `appendTerminalEvent()` to return full hydrated history.
- Current YAML/JSON metadata normalization returns flattened string fields and silently ignores unreadable or invalid files.

### Integration Points
- `src/runner.mjs`: replace unbounded `stdout += text` and `stderr += text` with bounded tail buffers and artifact streaming.
- `src/taskStore.mjs`: make `appendTerminalEvent()` avoid full-history hydration and add limited terminal event read helpers/metadata.
- `src/server.mjs`: adapt terminal SSE initial replay and task responses to limited terminal events/truncation metadata.
- `src/subagents.mjs`: replace `parseYamlMetadata()` internals with `js-yaml` while preserving public behavior.

</code_context>

<specifics>
## Specific Ideas

The desired behavior is conservative: preserve audit artifacts and existing public expectations where possible, but eliminate unbounded memory growth and O(N²) terminal event hydration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Memory Optimization and YAML Parser*
*Context gathered: 2026-05-29*
