# Codebase Integrations

The Codex Task Dispatch project is designed as a local orchestrator and does not directly connect to cloud services or third-party HTTP APIs itself. Its external integrations are strictly bounded to local tools and configurations.

## Primary Integrations
- **Codex CLI (`codex`)**: The core of the AI task execution. The application orchestrates tasks by constructing commands and spawning `codex exec` processes (e.g., `codex exec --sandbox workspace-write --json`).
- **Subagent Configurations**: It reads and parses agent definitions (YAML/JSON files) located in `.codex/agents` directories (either in the user's home directory or the local project directory) to provide subagent options to the user.

## External Services & APIs
- **LLM Providers (Implicit):** The codebase itself contains no logic for fetching data from OpenAI, Anthropic, or other LLM APIs. All AI interactions and authentication are delegated entirely to the `codex` CLI environment.
- **No external Web APIs:** The backend performs no external `fetch` or HTTP requests, acting purely as a local GUI/manager for the underlying Codex CLI tool.
