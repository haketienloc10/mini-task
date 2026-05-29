# Testing Strategy and Patterns

This document details the testing framework, strategies, and patterns employed across the codebase.

## Framework
- **Test Runner:** Built-in Node.js test runner (`node:test`).
- **Assertions:** Built-in Node.js strict assertions (`node:assert/strict`).
- **Execution:** Tests are executed via `node --test tests/*.test.mjs`.

## Test Categories
1. **API/Integration Tests (`server-api.test.mjs`):** 
   - Tests server endpoints using native fetch requests.
   - Spins up an HTTP server dynamically on an available port (`server.listen(0)`).
   - Simulates complete workflows from creating projects/tasks to running them.
2. **End-to-End Tests (`cockpit-e2e.test.mjs`):**
   - Focuses on complex state transitions (workflow states, action guards) of entities within the application.
3. **Unit Tests (`task-dispatch.test.mjs`):**
   - Validates specific internal behaviors like command generation and output parsing for the runner logic.
4. **Static UI Analysis (`ui-static.test.mjs`):**
   - Reads static files (`index.html`, `app.js`, `styles.css`) and asserts specific patterns (regex matches) to ensure DOM elements, navigation states, and CSS logic map correctly without needing a full browser environment.

## Patterns and Best Practices
- **Isolation:** Tests create isolated environments using temporary directories (`mkdtemp(path.join(tmpdir(), ...))`). This ensures file-based stores (`TaskStore`) and mocked workspaces do not leak across test runs.
- **Teardown:** The `finally` block or specific cleanup steps (e.g., `rm(root, { recursive: true, force: true })`) are meticulously used to clean up temporary files and close servers.
- **Mocking and Stubs:**
  - Mock runner scripts (`fake-codex-runner.mjs`) are configured in tests to simulate external dependencies without actual execution overhead.
  - Fake project and configuration files are dynamically written into test temp directories to mock external systems (e.g., creating pseudo-agent config via `createCodexAgents`).
- **Helpers:** Reusable helper functions like `request(url, options)` and `waitForTaskStatus` encapsulate repeated setup or polling logic in tests.
