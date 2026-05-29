# Project: Codex Task Dispatch (Nexus Ops)

## Overview
A lightweight, local-first monolithic Node.js application designed to orchestrate and dispatch agentic background tasks. It manages projects, coordinates external agent commands, and provides real-time progress tracking. 

## Target Audience
Local developers and AI agents running background tasks.

## Core Tech Stack
- **Backend:** Node.js (v20+), ES Modules (`"type": "module"`)
- **Storage:** SQLite (`better-sqlite3`) - *migrating from flat JSON files*
- **Frontend:** Vanilla HTML5, CSS3, JavaScript
- **Real-time:** Server-Sent Events (SSE)

## Current Milestone
Refactoring and resolving critical technical debt (identified in `CONCERNS.md`):
- Migrating to SQLite for robust storage and concurrency.
- Implementing an Event-Driven architecture to replace CPU-heavy polling loops.
- Optimizing memory management for task runners (streaming output).
- Integrating robust parsers (`js-yaml`).
