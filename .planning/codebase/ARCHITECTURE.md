# High-Level Architecture

Codex Task Dispatch is a lightweight, local-first monolithic Node.js application designed to orchestrate and dispatch agentic background tasks. It manages projects, coordinates external agent commands, and provides real-time progress tracking without relying on external databases.

## Components

### 1. Frontend Client (`public/`)
- **Vanilla JavaScript SPA**: The client is a Single Page Application built using plain HTML, CSS, and JavaScript, without the overhead of heavy frameworks or build tools.
- **Real-Time Reactivity**: Uses Server-Sent Events (SSE) to receive real-time updates regarding task status and streaming terminal outputs.
- **DOM Manipulation**: Directly manipulates the DOM via element references and state management within `app.js`.

### 2. API & Web Server (`src/server.mjs`)
- **Pure Node.js HTTP**: Implements a web server directly over the native `http` module.
- **RESTful API**: Serves standard CRUD endpoints for tasks and projects.
- **SSE Endpoints**: Maintains active connections (`/api/tasks/events`, `/api/tasks/:id/terminal-events`) and broadcasts state changes to connected clients via a polling/push mechanism.

### 3. Task Execution Engine (`src/runner.mjs`, `src/taskWorker.mjs`)
- **Detached Workers**: When a task is started, the server spawns a detached background Node process (`taskWorker.mjs`) to ensure task execution survives even if the main server restarts.
- **Command Orchestration**: The `runner.mjs` spawns external CLI processes (e.g., the `codex` command) and captures standard output and standard error.
- **JSON Parsing**: Captures and parses structured JSON logs from the agent CLI to track process references, token usages, and session context.

### 4. Data Persistence (`src/taskStore.mjs`)
- **File-Based JSON Storage**: Uses local `data/tasks.json` and `data/projects.json` to persist states.
- **Concurrency Control**: Implements file-locking mechanisms (`tasks.json.lock`) to prevent race conditions during concurrent data mutations.
- **Artifacts Management**: Generates dedicated directories inside `data/runs/` for each execution to store detailed logs (e.g., `stdout.log`, `prompt.txt`, `command.json`).
