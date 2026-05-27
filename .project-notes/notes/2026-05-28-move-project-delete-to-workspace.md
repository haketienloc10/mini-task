---
id: 2026-05-28-move-project-delete-to-workspace
type: continuity
task: move-project-delete-to-workspace
created_at: 2026-05-28
signal: Project deletion moved from Selected Project header into per-project trash icon controls in Workspace list.
areas:
- public/app.js
- public/index.html
- public/styles.css
tags:
- ui
decisions:
- Render each Workspace project as a container with separate select and delete buttons so the trash icon can delete that specific project.
invariants:
- Selecting a project remains bound to the project row select button; deleting a project still confirms before calling DELETE /api/projects/:id.
risks:
- No browser automation verified the visual spacing of the new per-project icon in very narrow sidebars.
tests:
- command: npm run build
  covers:
  - static assets remain valid after moving the delete control
- command: npm test
  covers:
  - existing project deletion API behavior remains unchanged
missing_tests:
- No DOM-level test covers clicking a project trash icon without selecting the project first.
---

## task
move-project-delete-to-workspace — 2026-05-28

## deviations
None

## traps
None

## dead_ends
None

## validation_delta
As expected

## next_agent_hint
See Handoff
