# Directory Structure & Module Breakdown

The repository is structured to separate the backend logic, frontend assets, and persistent data effectively.

## Directory Tree

- **`bin/`**: Contains executable CLI tools (e.g., `pnotes`).
- **`public/`**: Frontend assets served statically by the backend.
  - `index.html`: Main HTML entry point.
  - `app.js`: Core frontend application logic, state handling, and SSE client.
  - `styles.css`: UI styling and layout definitions.
- **`src/`**: Backend application logic.
  - `server.mjs`: The core HTTP server, routing API endpoints, managing SSE connections, and serving static files.
  - `taskStore.mjs`: Handles reading, writing, and locking of JSON data files, plus run artifact creation.
  - `runner.mjs`: Orchestrates the `child_process.spawn` logic to execute CLI commands, capturing output streams and telemetry.
  - `taskWorker.mjs`: The entry point for detached background processes that execute tasks via the `runner.mjs`.
  - `taskCockpit.mjs`: Utilities for task state enrichment, normalization, and standardizing 'needs input' states.
  - `subagents.mjs`: Utility functions for locating and listing available subagents based on workspace configuration.
- **`data/`**: (Generated at runtime) Local storage for database files and execution artifacts.
  - `projects.json` / `tasks.json`: Persistent JSON databases.
  - `runs/`: Nested folders storing logs and artifacts for specific task runs.
- **`scripts/`**: Utility scripts used for development and CI.
  - `check-static-assets.mjs`: Validates the existence and linking of necessary frontend assets.
  - `fake-codex-runner.mjs`: A mock script simulating the `codex` command for testing.
- **`tests/`**: Contains automated testing suites for the backend logic (e.g., `*.test.mjs`).
- **`.planning/`**: Contains project documentation and agent analysis artifacts.
  - `codebase/`: Location of mapped architecture and structure documents.
