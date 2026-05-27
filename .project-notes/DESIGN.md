---
name: Operations Console
product: Codex Task Dispatch
source_of_truth:
  - public/index.html
  - public/styles.css
  - public/app.js
colors:
  dark:
    bg: "#101317"
    surface: "#171B20"
    surfaceStrong: "#1F252C"
    surfaceMuted: "#12161B"
    border: "#2A323B"
    borderStrong: "#38424E"
    text: "#F4F6F8"
    textSoft: "#C1CAD4"
    textMuted: "#7D8996"
    accent: "#2F7DF6"
    success: "#1C9B6C"
    warning: "#C98119"
    danger: "#D9514E"
  light:
    bg: "#F5F7FA"
    surface: "#FFFFFF"
    surfaceStrong: "#EEF2F6"
    surfaceMuted: "#F8FAFC"
    border: "#D7DEE7"
    text: "#17202A"
    accent: "#2267D8"
typography:
  family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
  monospace: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace
radius: 8px
spacing:
  shell: 24px desktop, 14px mobile
  gridGap: 16px
---

## Overview

Codex Task Dispatch uses a dense operations-console UI for managing local Codex projects, tasks, subagents, runs, chat, and terminal evidence. The product is not a marketing site; the first screen is the working cockpit.

The visual language is utilitarian and information-first: dark mode by default, light mode supported, flat bordered panels, compact cards, status badges, and stable dashboard grids. The interface should feel like a project command center for repeated operational work.

## Information Architecture

The app has two primary routes:

- **Main board:** topbar, global metrics, project list, selected project board, and task preview.
- **Task detail:** back toolbar, agent menu, task cockpit summary, tabs for Chat, Terminal, Overview, and Activity.

The URL hash `#/tasks/:id` opens the task detail view. Clearing the hash returns to the board.

## Main Board

The board screen is organized as:

- **Topbar:** brand block "Project Command Center", theme toggle, and refresh action.
- **Metrics grid:** Projects, Active Tasks, Running Agents, Done.
- **Project panel:** selectable project list with description, workspace path, and small task stats.
- **Board panel:** selected project metadata, Needs Input filter, project delete, task creation, project overview, and four task columns.
- **Task preview panel:** selected task status, workflow, badges, agent, updated time, description, notes, and Open Detail action.

Task columns are fixed to these status groups: `Assigned`, `Running`, `Done`, `Failed`. Unknown task statuses fall back into `Assigned`.

## Task Detail

The task detail route focuses on acting on one task:

- **Toolbar:** back to main board, task title, delete task icon button.
- **Agent menu:** list of available subagents with Queue, Run, Done counts.
- **Task overview:** workflow, runner, evidence, agent, session, updated time, token usage, and next actions.
- **Tabs:** Chat, Terminal, Overview, Activity.

The Chat tab doubles as the run/follow-up control surface. The primary button label changes with task action state: `Start`, `Resume`, `Retry`, `Send`, or `Running`.

The Terminal tab supports `Pretty` and `Raw` views. Pretty mode parses Codex JSON events into categorized terminal rows such as `thread`, `turn`, `usage`, `tool`, `agent`, and `exit`.

## Interaction Model

Use immediate, low-friction controls:

- Buttons for explicit commands: create, refresh, delete, start, resume, retry, follow-up, needs-input actions.
- Tabs for detail sections.
- Badges for attention states: `Needs input`, `Retryable`, `Missing evidence`, `Evidence present`, `Verified`.
- Prompts are currently used for destructive confirmation and manual Needs Input messages.
- Realtime updates arrive through SSE endpoints for task snapshots and terminal events.

The UI should preserve selected project/task where possible and avoid layout shifts while data refreshes.

## Visual System

The current design system is token-driven CSS in `public/styles.css`.

- **Shape:** `--radius: 8px` across panels, cards, buttons, inputs, modals, and badges.
- **Surfaces:** `--bg` for page background, `--surface` for panels, `--surface-muted` for nested rows/cards, `--surface-strong` for selected states.
- **Borders:** one-pixel borders separate most elements; active selection uses stronger border plus a 3px left accent rail.
- **Shadow:** panels use `--shadow`; nested cards generally rely on borders, not heavy elevation.
- **Typography:** uppercase 12px labels for metadata; compact headings; monospace for workspace paths, code, terminal output, and artifacts.
- **Theme:** dark is default via `localStorage.theme || "dark"`; light mode changes CSS variables and `theme-color`.

## Status Semantics

Color usage is functional:

- **Accent blue:** primary actions, selected project/task rails, focused inputs.
- **Warning amber:** running state and Needs Input attention.
- **Success green:** done, verified, evidence present, successful exits.
- **Danger red:** failed/cancelled, retryable/missing evidence, delete actions, stderr/errors.
- **Muted gray:** idle, assigned, metadata, empty states.

Do not introduce decorative gradients or brand-heavy illustration. This UI is a compact work surface.

## Responsive Behavior

Desktop layout targets a wide operations workspace:

- Shell max width: `min(1680px, 100%)`.
- Main grid: project panel `260-320px`, board `1fr`, preview `320-380px`.
- Task board: four columns, each at least `180px`, with horizontal overflow when needed.

Breakpoints:

- `max-width: 1320px`: preview panel drops below the project/board grid.
- `max-width: 900px`: topbar and main/detail layouts become single column; board columns stack; chat max height is relaxed.
- `max-width: 560px`: metrics, overview, chat input, activity rows, headers, and toolbar collapse to one column.

## Modals And Forms

There are two modal forms:

- Create Project: name, description, workspace path.
- Create Task: project, title, description, agent, notes.

Forms use the same surface, border, radius, and input tokens as the rest of the app. Form messages are inline status text, not toast notifications.

## Design Constraints

- Keep the app as a dense dashboard, not a landing page.
- Prefer existing CSS variables and class patterns before adding new styles.
- Keep cards compact; use cards for repeated project/task/agent/detail items, not decorative page sections.
- Preserve the status vocabulary and action guard semantics from `taskCockpit`.
- Use icons only where they improve scan speed; current delete actions use an inline trash icon.
- Avoid changing adjacent layout or visual rules unless a UI change explicitly requires it.
