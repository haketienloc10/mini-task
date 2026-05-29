# Requirements: Refactoring & Technical Debt

## User Stories & Features

### 1. Storage Backend Migration
- **As a system**, I need to store tasks and projects in a reliable database (SQLite) so that high-concurrency write operations do not cause locks, IO bottlenecks, or data corruption.
- **Acceptance Criteria**:
  - `better-sqlite3` is integrated.
  - `tasks.json` and `projects.json` logic in `src/taskStore.mjs` is completely replaced by SQLite queries.
  - No custom file locking mechanisms are needed.
  
### 2. Event-Driven PubSub for SSE
- **As a client**, I need real-time updates via SSE without overloading the server with polling loops.
- **Acceptance Criteria**:
  - 250ms polling interval in `src/server.mjs` is removed.
  - `TaskStore` emits events (e.g., `taskUpdated`, `terminalUpdated`) upon state changes.
  - SSE endpoints push updates immediately upon receiving an event.

### 3. Output Streaming & Memory Optimization
- **As a system**, I need to handle tasks that produce massive stdout/stderr without crashing due to Out-Of-Memory (OOM) errors.
- **Acceptance Criteria**:
  - `runner.mjs` limits or streams the buffered output.
  - Process outputs are written efficiently without ballooning in memory.

### 4. Robust Configuration Parsing
- **As a developer**, I need robust YAML parsing for configuration files.
- **Acceptance Criteria**:
  - The custom regex-based parser in `src/subagents.mjs` is replaced with `js-yaml`.

## Non-Functional Requirements
- **Performance:** Significant reduction in CPU and Disk I/O usage during concurrent task executions.
- **Minimalism:** Maintain the zero-build vanilla HTML/JS/CSS stack for the frontend.
