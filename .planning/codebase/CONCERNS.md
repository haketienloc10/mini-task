# Codebase Concerns

This document outlines identified technical debt, potential issues, and areas for improvement in the `codex-task-dispatch` project.

## 1. Data Storage & Concurrency
- **Inefficient Storage Backend:** The application uses flat JSON files (`tasks.json`, `projects.json`) as a database.
- **Extreme I/O Bottleneck:** In `TaskStore` (`src/taskStore.mjs`), operations like `appendTerminalEvent` rewrite the entire `tasks.json` file. Since terminal events are generated for every stdout/stderr chunk, a verbose process will trigger hundreds or thousands of read-parse-stringify-write cycles on the whole file, leading to immense I/O pressure and high CPU usage.
- **In-memory Blob Growth:** `terminalEvents` are stored directly inside the task objects. This causes `tasks.json` to grow indefinitely, slowing down every read and write linearly over time.
- **Custom Lock Mechanism:** The `#withTasksLock` method relies on creating/deleting a directory (`tasks.json.lock`) in a spin-wait loop with a 10ms delay. This can cause starvation under high concurrency and may fail to release locks if the application crashes at an inopportune time.

## 2. Server & SSE Architecture
- **Aggressive Polling Loop:** In `src/server.mjs`, SSE subscriptions trigger a polling interval (`SSE_POLL_INTERVAL_MS = 250ms`). This loop calls `store.listTasks()` which performs a filesystem read and JSON parse of the potentially massive `tasks.json` file 4 times per second per connected state, crippling the server under load.
- **Expensive Change Detection:** The SSE update mechanism compares task state by stringifying the entire task minus a few fields (`JSON.stringify(taskState)`). This is a heavy O(N) operation running inside the 250ms loop.

## 3. Process Execution & Memory Management
- **Unbounded Memory Consumption:** In `src/runner.mjs`, the `executeProcess` function buffers all standard output and error directly in memory (`stdout += text; stderr += text;`). If a child process outputs a large amount of data, this will cause an Out-Of-Memory (OOM) crash.
- **Zombie Processes & Cleanup:** Task workers are spawned as detached processes (`taskWorker.mjs`). The `recoverInterruptedRunningTasks` function checks if a PID exists (`isLikelyActiveRun`), but OS PIDs get reused, leading to false positives where tasks remain perpetually "Running". Furthermore, there is no garbage collection for old artifact directories in `data/runs/`, which could exhaust disk space.

## 4. Parsing Fragility
- **Regex-based YAML Parsing:** `src/subagents.mjs` attempts to parse YAML files using a custom regex approach (`parseYamlMetadata`). This is highly fragile and will break unexpectedly with multi-line strings, lists, or non-standard indentation. A robust YAML parser (e.g., `js-yaml`) should be integrated instead.
- **Silent Input Errors:** `readJson` in `server.mjs` returns an empty object `{}` upon JSON parsing failures, which silently swallows bad requests rather than returning a `400 Bad Request`.

## 5. Security Posture
- **Unauthenticated API:** The HTTP server currently exposes project manipulation, task creation, and arbitrary command execution without authentication or authorization.
- **Command Injection Risks:** The execution pipeline in `runner.mjs` allows overriding arguments and environments. Without strict validation, malicious task inputs or environment variable manipulation (`CODEX_TASK_COMMAND`) could lead to remote code execution (RCE) on the host.

## Recommended Improvements
1. **Database Migration:** Replace the JSON flat-file system with a lightweight embedded database like SQLite (e.g., using `better-sqlite3`). This will resolve the lock contention, O(N^2) write inefficiencies, and expensive polling loops (via triggers or logical replication/pubsub).
2. **Event-Driven PubSub:** Replace the 250ms polling loop in `server.mjs` with an event emitter model. The `TaskStore` should emit `taskUpdated` events internally so the SSE endpoint can stream updates instantly without disk reads.
3. **Stream Outputs:** Limit or stream the process output in `runner.mjs` instead of holding it completely in memory.
4. **Use Proper Parsers:** Swap out the regex YAML parser for a standard library to ensure robust configuration parsing.
