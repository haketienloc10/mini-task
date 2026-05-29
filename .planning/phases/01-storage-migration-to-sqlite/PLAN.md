# Phase 1: Storage Migration to SQLite - Plan

## 1. Setup & Dependencies
- **Task:** Install `better-sqlite3`
- **Action:** Run `npm install better-sqlite3`. Ensure it is added to `package.json`.

## 2. Implement Database Schema & Initialization
- **Task:** Rewrite `TaskStore` initialization in `src/taskStore.mjs`.
- **Action:** 
  - Connect to SQLite database (`data/codex-tasks.sqlite`) with WAL mode enabled (`PRAGMA journal_mode = WAL;`).
  - Create tables: `projects`, `tasks`, and `task_events`.
  - Handle JSON serialization/deserialization for complex fields in `tasks` table (like `messages`, `needsInput`).

## 3. Data Migration (JSON to SQLite)
- **Task:** Migrate existing `tasks.json` and `projects.json`.
- **Action:** 
  - In `init()`, check if `tasks.json` and `projects.json` exist.
  - If they do and SQLite DB is empty, parse them and insert all data into the SQLite tables.
  - After migration, rename the `.json` files to `.json.bak` to preserve data and avoid re-migrating.

## 4. Refactor TaskStore Methods
- **Task:** Replace file-based reads/writes and locks with SQLite queries.
- **Action:** 
  - Update `listProjects`, `getProject`, `createProject`, `deleteProject` to use SQL.
  - Update `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask` to use SQL.
  - Update `appendTerminalEvent` to insert into the `task_events` table instead of array push. Fetching a task should retrieve these events in chunks/paginated or as a single array depending on the API needs.

## 5. Verify & Test
- **Task:** Ensure all tests pass.
- **Action:** 
  - Run `npm test`.
  - Fix any failing tests in `tests/task-dispatch.test.mjs` and `tests/server-api.test.mjs`. (The mock `TaskStore` instances might need cleanup).
