# PROJECT.md

> Workspace discovery map for future agents.
> Filled from repository inspection on 2026-05-28.

---

## 1. Project Identity

### Project Name

mini-task

### One-line Description

Local web app for managing projects, dispatching tasks to Codex CLI/subagents, and reviewing run output, chat history, terminal events, and evidence.

### Project Type

Node.js web app with HTTP API, static frontend, local JSON storage, and Codex CLI runner integration.

### Primary Users

Local operators/developers coordinating Codex agent work across workspaces.

### Current Maturity

MVP

---

## 2. Workspace Overview

### Root Structure

    .
    ├── .agents/              # local agent skills
    ├── .codex/               # project-local Codex config/agents
    ├── .project-notes/       # project discovery and continuity notes
    ├── bin/                  # local tooling, including pnotes
    ├── data/                 # local persisted projects/tasks/runs
    ├── logs/                 # local logs
    ├── public/               # browser UI
    ├── scripts/              # support/smoke scripts
    ├── src/                  # server, store, runner modules
    └── tests/                # node:test coverage

### Important Directories

| Path | Purpose | Notes |
|---|---|---|
| `src/` | HTTP server, task store, runner, subagent discovery, task enrichment | ESM modules using Node built-ins. |
| `public/` | Static browser app | `index.html`, `app.js`, `styles.css`; no frontend build step. |
| `tests/` | API, runner/store, cockpit workflow tests | Uses Node's built-in `node:test`. |
| `scripts/` | Test helpers and static asset smoke check | `fake-codex-runner.mjs` is used by tests. |
| `data/` | Runtime state | Ignored by git; stores `projects.json`, `tasks.json`, and `runs/`. |
| `.project-notes/` | Agent-facing docs and continuity notes | `PROJECT.md` and `DESIGN.md` are reusable discovery maps. |

### Important Files

| File | Purpose | Notes |
|---|---|---|
| `package.json` | Scripts and Node engine | Requires Node `>=20`; no dependencies declared. |
| `src/server.mjs` | Main HTTP server and API router | Also serves static assets from `public/`; default `PORT=3000`. |
| `src/taskStore.mjs` | JSON-backed persistence layer | Uses atomic temp-file writes and a lock directory for task mutations. |
| `src/runner.mjs` | Codex CLI command builder/executor | Runs `codex exec --sandbox workspace-write --json`; supports resume. |
| `src/taskWorker.mjs` | Detached worker process entry | Lets task execution continue after HTTP server shutdown. |
| `src/subagents.mjs` | Subagent discovery | Reads `.yaml`, `.yml`, `.json` agent metadata under `agents/` directories. |
| `src/taskCockpit.mjs` | Derived workflow/runner/action/evidence state | Normalizes legacy task fields. |
| `public/app.js` | Browser UI behavior | Project/task board, detail route, chat, terminal stream, theme. |
| `bin/pnotes` | Project notes CLI | Required by repo instructions before exploration/implementation. |

---

## 3. Tech Stack

### Languages

| Language | Where Used | Notes |
|---|---|---|
| JavaScript ESM | `src/`, `public/`, `scripts/`, `tests/` | `"type": "module"` in `package.json`. |
| HTML | `public/index.html` | Static single-page UI. |
| CSS | `public/styles.css` | Custom CSS variables, dark/light themes, responsive layout. |
| JSON | `data/*.json`, config, runtime artifacts | Local persistence and runner artifacts. |

### Frameworks / Runtime

| Tool | Purpose | Evidence |
|---|---|---|
| Node.js `>=20` | HTTP server, tests, scripts | `package.json` `engines.node`. |
| Node built-in `http` | API and static file server | `src/server.mjs`. |
| Node built-in `node:test` | Automated tests | `tests/*.test.mjs`. |
| Codex CLI | Actual task runner | `src/runner.mjs` default command is `codex`. |
| Server-Sent Events | Task lifecycle and terminal streaming | `/api/tasks/events`, `/api/tasks/:id/terminal-events`. |

### Package Managers

| Manager | Lockfile / Evidence | Notes |
|---|---|---|
| npm | `package.json`; no lockfile observed | Scripts use `npm run ...` / `npm test`. |

---

## 4. How To Run

### Install Dependencies

    npm install

No external dependencies are currently declared, but this is the standard setup command.

### Start Development Server

    npm run dev

Server listens on `http://127.0.0.1:3000` by default.

### Build

    npm run build

This is a static asset smoke check, not a bundle step.

### Test

    npm test

### Lint / Format / Typecheck

    not configured

### Smoke Check

    npm run build

---

## 5. Architecture Map

### Main Entry Points

| Path | Role |
|---|---|
| `src/server.mjs` | Creates the HTTP server, API routes, SSE streams, static serving, worker spawning. |
| `src/taskWorker.mjs` | Detached child process entry for task execution. |
| `public/index.html` | Browser shell and modals. |
| `public/app.js` | UI state, API calls, route/render logic, EventSource subscriptions. |

### Core Modules

| Module / Directory | Responsibility | Important Dependencies |
|---|---|---|
| `src/server.mjs` | API validation, project/task routes, SSE polling, recovery of interrupted runs | `TaskStore`, `runner`, `subagents`, `taskCockpit`, Node `http`, `child_process`. |
| `src/taskStore.mjs` | Persistent project/task CRUD, migrations, run artifact writing | Node `fs/promises`, `crypto`, `taskCockpit`. |
| `src/runner.mjs` | Workspace validation, Codex command construction, process execution, JSON output parsing | Node `child_process`, `subagents`. |
| `src/subagents.mjs` | Finds available subagents from home/project `.codex` roots | Node `fs`, `os`, `path`; simple YAML/JSON metadata parser. |
| `src/taskCockpit.mjs` | Derived states and action guards for UI/API | Pure JS; no external deps. |
| `public/` | Operations console UI | Browser DOM APIs and `EventSource`. |

### Data Flow

    Browser UI
      -> HTTP API in src/server.mjs
      -> TaskStore reads/writes data/projects.json and data/tasks.json
      -> run request spawns detached src/taskWorker.mjs
      -> runner builds codex exec command in the project workspace
      -> run artifacts written under data/runs/
      -> terminal/task updates streamed back over SSE
      -> UI renders board, chat, terminal, activity, and evidence state

### State / Storage

| Storage | Location / Service | Used For |
|---|---|---|
| Projects JSON | `data/projects.json` | Project id, name, description, workspace path. |
| Tasks JSON | `data/tasks.json` | Task lifecycle, messages, terminal events, token usage, evidence pointers. |
| Task lock dir | `data/tasks.json.lock` | Coarse lock for task mutations. |
| Run artifacts | `data/runs/<taskId>-<runRef>/` | `prompt.txt`, `command.json`, `stdout.log`, `stderr.log`, `error.log`. |
| Browser localStorage | key `theme` | Dark/light theme preference. |

---

## 6. Configuration

### Environment Variables

| Variable | Required | Purpose | Default / Example |
|---|---:|---|---|
| `PORT` | no | HTTP server port | `3000` |
| `CODEX_TASK_DATA_DIR` | no | Override runtime data directory | `data` |
| `CODEX_TASK_COMMAND` | no | Override runner command | `codex` |
| `CODEX_TASK_TIMEOUT_MS` | no | Process timeout for task runs | `1800000` |
| `CODEX_TASK_WORKER_PAYLOAD` | internal | JSON payload passed to detached worker | Set by `src/server.mjs`. |

### Config Files

| File | Purpose |
|---|---|
| `package.json` | Node metadata and scripts. |
| `.gitignore` | Ignores `data/`, `node_modules/`, `coverage/`, `bin/`, `target/`, `**/target/`. |
| `.codex/config.toml` | Project-local Codex config. |
| `.devin/config.local.json` | Local Devin config. |

### Ports / External Services

| Service | Port / URL | Purpose |
|---|---|---|
| Local app | `http://127.0.0.1:3000` by default | Browser UI and API. |
| Codex CLI | local executable `codex` | Runs assigned tasks in target workspace. |

---

## 7. Testing & Quality

### Existing Test Locations

| Path | Test Type | Notes |
|---|---|---|
| `tests/task-dispatch.test.mjs` | unit/integration | Runner command shape, JSON parsing, store migration, run behavior. |
| `tests/server-api.test.mjs` | integration | API CRUD, task execution, SSE, chat/session resume, deletion guards. |
| `tests/cockpit-e2e.test.mjs` | e2e-style integration | Workflow/action guards and cockpit states through HTTP API. |
| `scripts/check-static-assets.mjs` | smoke | Verifies required files exist and HTML references static assets. |

### Test Commands

    npm run build
    npm test

### Quality Gates

- [ ] Install works
- [x] Build passes
- [x] Tests pass
- [ ] Lint/typecheck passes
- [x] Smoke check passes

### Known Gaps

- No lint, formatter, or typecheck script is configured.
- No browser automation test was observed for the static UI.
- No package lockfile was observed.
- Runtime `data/` is ignored and may contain large local task/run history; inspect selectively.

---

## 8. Development Rules

### Code Style

- Use ESM imports/exports and Node built-ins.
- Prefer small pure helpers near the module that owns the behavior.
- Server responses are plain JSON via local `sendJson`; static content types are hard-coded in `src/server.mjs`.
- Frontend uses direct DOM refs, template strings, and `escapeHtml`; no framework.

### Naming Conventions

- Task statuses are capitalized strings: `Created`, `Assigned`, `Running`, `Done`, `Failed`, `Cancelled`.
- Derived UI states are lowercase snake-case-ish strings such as `needs_input`, `evidence_present`.
- Subagent ids are slugified from agent metadata path/label.

### Patterns To Follow

- Validate API input at the route boundary, then let `TaskStore` enforce persistence invariants.
- Enrich tasks with `enrichTask()` before returning to API/UI clients.
- Use project `workspacePath` for task runs when `projectId` is available; task-level `workspacePath` is legacy fallback.
- Persist run evidence under `data/runs/` and link it from `runArtifactPath`.
- Preserve SSE behavior: terminal event updates should not spam lifecycle task events.

### Anti-patterns To Avoid

- Do not add frontend framework/build tooling unless explicitly requested.
- Do not reintroduce deprecated Codex args like `--cwd` or `--prompt-file`; runner relies on process `cwd` and stdin.
- Do not delete running tasks/projects; current API rejects this with `409`.
- Do not treat `data/` as source-controlled fixture state.

---

## 9. Change Boundaries

### Safe To Modify

| Area | When |
|---|---|
| `src/*.mjs` | Backend, runner, store, state derivation changes with focused tests. |
| `public/index.html`, `public/app.js`, `public/styles.css` | UI behavior/markup/style changes; run static smoke check. |
| `tests/*.test.mjs` | Add or update coverage for behavior changes. |
| `scripts/*.mjs` | Test helpers or smoke tooling. |
| `.project-notes/*.md` | Documentation/discovery updates. |

### Requires Extra Care

| Area | Reason |
|---|---|
| `src/runner.mjs` | Codex CLI invocation, session resume, token parsing, and run evidence depend on command shape. |
| `src/taskStore.mjs` | Local persistence, migrations, and lock behavior affect real user data. |
| `src/server.mjs` | Owns API contract, SSE delivery, worker lifecycle, and recovery logic. |
| `public/app.js` | Large single-file UI; route, stream, and render state are tightly coupled. |
| `data/` | Runtime data, ignored by git, may include large/local user task history. |

### Do Not Modify Without Explicit Approval

| Area | Reason |
|---|---|
| User runtime data in `data/` | Can alter local task/project history. |
| `.git/` | Repository internals. |
| `.codex/`, `.devin/`, `.antigravitycli/` | Tooling config outside normal app behavior unless task is about those tools. |

---

## 10. Current Product Behavior

### Main User Flows

| Flow | Description | Entry Points |
|---|---|---|
| Create project | User provides name, optional description, required workspace path. | UI modal, `POST /api/projects`. |
| Create task | User selects project/subagent and provides title, description, notes. | UI modal, `POST /api/tasks`. |
| Run task | Assigned task starts a detached worker that invokes Codex CLI in project workspace. | `POST /api/tasks/:id/run` with mode `start`. |
| Resume/follow-up | Completed task with `sessionRef` can resume or accept a prompt follow-up. | `POST /api/tasks/:id/run` with `resume` or `followup`. |
| Retry failed task | Failed task can rerun from a fresh session. | `POST /api/tasks/:id/run` with `retry`. |
| Mark needs input | Non-running task can be manually marked/cleared as needing input. | `PATCH /api/tasks/:id/needs-input`. |
| Observe updates | UI listens for task lifecycle and terminal SSE events. | `/api/tasks/events`, `/api/tasks/:id/terminal-events`. |
| Delete task/project | Allowed only when no affected task is `Running`. | `DELETE /api/tasks/:id`, `DELETE /api/projects/:id`. |

### Important Business Rules

- `projectId`, task `title`, task `description`, and valid `subagent` are required for task creation.
- Project `name` and `workspacePath` are required for project creation.
- Running tasks cannot be deleted or marked as needing input.
- Projects with running tasks cannot be deleted.
- On server startup, stale `Running` tasks without live `workerRef`/`processRef` are marked `Failed` with a recovery message.
- A default `Default` subagent always exists, even if no agent metadata files are found.
- Non-default subagents are discovered from home `.codex` and project `.codex` roots.

### UI / UX Notes

- First screen is an operations console: metrics, project sidebar, task board, preview panel.
- Detail route uses hash form `#/tasks/<id>` and exposes Chat, Terminal, Overview, Activity tabs.
- UI supports dark/light theme with `localStorage` persistence.
- Terminal view has `Pretty` and `Raw` modes and interprets Codex JSON event lines.
- `Needs Input`, retryability, and evidence state are shown as badges.

---

## 11. Known Issues / Risks

| Issue / Risk | Evidence | Impact |
|---|---|---|
| Local JSON storage can be corrupted by manual edits or unexpected process interruption outside guarded writes. | `TaskStore` persists to JSON files under `data/`. | App startup/API may fail on invalid JSON. |
| `data/tasks.json` can grow large because terminal events and messages are embedded per task. | Runtime file observed with large task history. | Slow reads, noisy inspection, larger SSE payloads. |
| Detached worker state depends on process ids and local OS process checks. | `recoverInterruptedRunningTasks()` uses `process.kill(pid, 0)`. | PID reuse or platform behavior can affect recovery accuracy. |
| Subagent YAML parser is intentionally simple. | `src/subagents.mjs` parses scalar metadata only. | Complex YAML metadata may not be read as expected. |
| UI tests do not exercise browser rendering. | Tests are HTTP/module focused; no Playwright/Cypress observed. | Layout regressions may pass automated checks. |

---

## 12. Agent Operating Notes

### Discovery Method Used

- [x] README / docs
- [x] package/config files
- [x] source tree
- [x] tests
- [x] scripts
- [ ] CI config
- [x] runtime logs/data
- [x] other: `.project-notes/DESIGN.md`, `AGENTS.md`, `pnotes brief/recall`

### Verified Commands

| Command | Result | Notes |
|---|---|---|
| `./bin/pnotes brief --area . --limit 10` | pass | No project memory found for area. |
| `./bin/pnotes recall --area . --limit 10` | pass | No notes found. |
| `npm run build` | pass | `Static asset check passed`. |
| `npm test` | pass | All `node:test` suites passed. |

### Assumptions

- `npm install` is the expected dependency install command because only `package.json` exists; this command was not run.
- Maturity is marked `MVP` because the project has working app/tests but uses local JSON persistence and no production deployment/CI evidence was observed.
- No CI config was found in the files inspected.

### Open Questions

- Should `data/tasks.json` terminal/history retention be capped or archived?
- Should the UI get browser-level automated tests?
- Should a lockfile be committed for reproducible npm behavior?

---

## 13. Maintenance Log

### Last Updated

2026-05-28

### Updated By

Codex

### Summary Of Changes

- Replaced the PROJECT.md template with a factual discovery map for the current Node/Codex task dispatch app.
- Documented structure, stack, run/test commands, architecture, storage, config, behavior, risks, and agent operating notes.
