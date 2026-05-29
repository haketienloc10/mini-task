# Coding Conventions

This document outlines the coding standards and conventions used in this project.

## Language and Syntax
- **Language:** JavaScript with ECMAScript Modules (`.mjs` extension). The project uses `"type": "module"` in `package.json`.
- **Version:** Node.js >= 20.
- **Features:** Modern ES6+ syntax is heavily used, including:
  - `async/await` for asynchronous operations.
  - Template literals for string interpolation.
  - Destructuring and rest/spread operators.
  - Optional chaining (`?.`) and nullish coalescing (`??`).
  - Classes with private fields (`#propertyName`) and private methods (e.g., in `TaskStore`).

## Node.js Standard Library
- Core modules are explicitly imported with the `node:` prefix (e.g., `import path from 'node:path'`, `import { mkdir } from 'node:fs/promises'`).
- The project minimizes external dependencies, relying strongly on Node.js built-in modules for core functionality.

## Project Structure
- `src/`: Contains core business logic, application server, and task runner integration.
- `tests/`: Contains all test suites using the native `node:test` runner.
- `public/`: Frontend static assets (HTML, CSS, JS).
- `scripts/`: Assorted scripts, such as build checks and mock runners.

## Architecture and State Management
- Data persistence is handled mainly via file-based JSON stores (e.g., `tasks.json`, `projects.json`) in the `data/` directory (managed by `TaskStore`).
- The application relies on explicit state transitions for entities like tasks (`Created`, `Assigned`, `Running`, `Done`, `Failed`, `Cancelled`).
