---
id: 2026-05-28-fix-project-select-dark-mode-color
type: continuity
task: fix-project-select-dark-mode-color
created_at: 2026-05-28
signal: Project select button now inherits the project row colors instead of showing default button styling in dark mode.
areas:
- public/styles.css
tags:
- ui
decisions:
- Reset .project-select background, color, padding, and width so only .project-item provides the visible project card surface.
invariants:
- The project row still has a separate select button and delete icon; selection and deletion controls remain distinct.
risks:
- No browser screenshot was captured because the sandbox cannot run the local server.
tests:
- command: npm run build
  covers:
  - static CSS/asset checks pass after the dark-mode button reset
missing_tests:
- No visual regression test covers dark-mode project row color matching.
---

## task
fix-project-select-dark-mode-color — 2026-05-28

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
