# Codebase Stack

The Codex Task Dispatch (Nexus Ops) project follows a minimalist, zero-dependency architecture. It relies entirely on native capabilities without pulling in external libraries.

## Core Technologies
- **Runtime:** Node.js (v20+)
- **Module System:** ES Modules (`"type": "module"`)

## Backend
- **Framework:** None. Uses vanilla Node.js native modules (`node:http`, `node:fs/promises`, `node:child_process`, `node:crypto`).
- **Database / Storage:** Local flat-file JSON storage (`data/tasks.json`, `data/projects.json`) with a file-based locking mechanism to handle concurrency.
- **Real-time Communication:** Server-Sent Events (SSE) implemented from scratch to stream task updates and terminal outputs to clients.
- **Process Management:** Manages long-running tasks via isolated detached child processes (`node:child_process.spawn`).

## Frontend
- **Framework:** None. Pure Vanilla HTML5, CSS3, and JavaScript.
- **Styling:** Custom CSS with CSS Variables for theming (Light/Dark mode).
- **Interactivity:** Native DOM APIs and Event Listeners. No bundler is used for frontend assets; they are served directly from the `public/` directory.

## Testing & Tooling
- **Test Runner:** Native Node.js test runner (`node --test`).
- **Build/CI:** Custom minimal scripts (`scripts/check-static-assets.mjs`) replacing standard build steps.
