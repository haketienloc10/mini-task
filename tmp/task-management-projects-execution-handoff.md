# Execution Handoff

## 1. Objective

Update the Task Management navigation so `Du an` is the primary project-oriented screen entry and appears before `Cong viec` in the sidebar. Keep the existing project/task management behavior intact and avoid backend or data model changes.

## 2. Final Decision

Keep the existing internal render contract: `activeTab = 'kanban'` continues to show `mainView`, which already contains the project list, selected project overview, and task board.

Expose that existing screen through two sidebar entries:
- `Du an`: primary/default entry, displayed before `Cong viec`, opens the existing `kanban`/`mainView`.
- `Cong viec`: secondary alias after `Du an`, also opens the existing `kanban`/`mainView` because the task board currently lives inside the project context.

Executor must add a small nav-identity guard so only the clicked sidebar item is active. Do not let two sidebar entries become active just because they share the same internal `activeTab`.

## 3. Original Request Alignment

- Thay doi/Mo rong so voi yeu cau goc: Adds an explicit active navigation identity guard because both `Du an` and `Cong viec` need to point at the existing screen without duplicate active state.
- Thu hep/Tri hoan: Do not rename internal `kanban` state/routes/classes to `projects`; do not create a standalone task-only screen; do not implement advanced project management beyond the current screen.

## 4. Implementation Scope

- **In Scope:**
  - Reorder the sidebar so `Du an` appears before `Cong viec`.
  - Make `Du an` the primary/default sidebar entry for the existing project/task management screen.
  - Keep `Cong viec` as a secondary sidebar entry that opens the same existing screen.
  - Remove the current sidebar path to the `projects` placeholder.
  - Replace user-facing `Workspace`/`Projects` labels in the main project/task screen header area with Vietnamese project-oriented copy where appropriate.
  - Add minimal client-side state or attributes needed to track active sidebar identity separately from the internal render tab.

- **Out of Scope:**
  - Backend/API/storage/schema changes.
  - Renaming `workspacePath`, API fields, internal CSS classes such as `.workspace-layout`, or server-side workspace terminology.
  - Redesigning navigation or adding new screens.
  - Changing task/project workflow, task board columns, modals, delete behavior, SSE, or route hash behavior for task detail.

## 5. Target Files / Areas To Inspect Or Modify

| Area / File Path | Expected Work |
|---|---|
| `public/index.html` | Reorder sidebar entries. Make `Du an` appear before `Cong viec`. Ensure both entries can target the existing project/task screen without using the old `projects` placeholder path. Update the main project panel user-facing labels from `Workspace`/`Projects` to project-oriented Vietnamese copy if visible in the `mainView`. |
| `public/app.js` | Keep `activeTab = 'kanban'` as the render contract for `mainView`. Add a separate active nav identity, for example `activeNavItem`, for sidebar active state and page title/subtitle copy. Update nav click handling, `renderShell`, and `renderRoute` so `Du an`/`Cong viec` both show `mainView` but only the clicked nav item is active. Remove sidebar reachability of the `projects` placeholder. |
| `public/styles.css` | Only touch if the new labels cause layout overflow or active-state styling needs to target the new nav identity. Do not rename existing layout classes unless required. |
| `tests/` or static checks | Inspect for UI/static tests or snapshots related to navigation labels. Add/update only focused tests if the repo has a suitable browser/static test surface. |

## 6. Technical Contracts

- **Data / State Contract:**
  - Preserve `state.activeTab` values used for rendering existing views.
  - `activeTab = 'kanban'` must continue to mean: show `mainView`.
  - Add/maintain a separate sidebar identity, e.g. `state.activeNavItem`, with values such as `dashboard`, `projects`, `tasks`, `agents`, `settings`.
  - Default project/task screen identity should be `projects`/`Du an`, while internal target remains `kanban`.
  - Do not modify project/task object fields, `workspacePath`, `projectId`, status enums, or API response shapes.

- **Action / Guard Contract:**
  - On sidebar click, determine both:
    - target render tab, e.g. `kanban`;
    - clicked nav identity, e.g. `projects` or `tasks`.
  - Active sidebar class must compare against nav identity, not only shared target tab.
  - If `Du an` and `Cong viec` both target `kanban`, exactly one of them may have `.active` at a time.
  - Task-detail hash behavior remains unchanged: opening task detail still hides normal views and back-to-board returns to internal `kanban`.

- **UI / UX Contract:**
  - Sidebar order: `Dashboard` -> `Du an` -> `Cong viec` -> `Agents AI`, with `Cai dat` in the footer as before.
  - Click `Du an`: show existing project list + project overview + task board screen. Page title should be `Du an` or equivalent project-oriented Vietnamese copy, not `Task Management` or `Workspace`.
  - Click `Cong viec`: show the same existing screen, with page title/copy allowed to emphasize tasks, but not the old `projects` placeholder.
  - The visible main project panel must not use `Workspace` as its primary label. Use Vietnamese project-oriented copy such as `Du an`.
  - The technical field label `Workspace path` in forms or detail views may remain if it refers specifically to filesystem paths.

- **API / Backend Contract:**
  - No API changes.
  - Existing endpoints `/api/projects`, `/api/tasks`, `/api/subagents`, task run/chat/needs-input/delete flows remain unchanged.
  - No persistence changes.

## 7. Execution Plan For Future Executor

1. Inspect `public/index.html` sidebar buttons and `mainView` labels.
2. Inspect `public/app.js` nav click handling, `renderShell`, and `renderRoute`.
3. Add a minimal nav mapping so `Du an` and `Cong viec` can both target `kanban` while keeping separate active identities.
4. Reorder sidebar and remove the visible sidebar path to the placeholder `projects` tab.
5. Update only user-facing labels/copy needed for `Du an` as the primary screen.
6. Run static/build checks and tests.
7. Manually verify both sidebar click paths in the running UI or with DOM/browser evidence.

## 8. Verification & Risks

- **Acceptance Criteria:**
  - Sidebar displays `Du an` before `Cong viec`.
  - Click `Du an` opens the real project/task management screen, not placeholder content.
  - Click `Cong viec` still opens a usable task board/list view.
  - Only the clicked sidebar item is active; `Du an` and `Cong viec` are never active at the same time.
  - `projects` placeholder is not reachable from the sidebar.
  - No user-facing primary label `Workspace` remains in the Task Management main screen area; technical filesystem labels may remain.
  - No backend/data/workflow behavior changes.

- **Required Tests:**
  - `npm run build`
  - `npm test`
  - If adding browser/static UI tests is practical, cover sidebar order and click behavior for `Du an` and `Cong viec`.

- **Regression Risks:**
  - Duplicate active sidebar state if active styling still compares only `data-nav-tab`.
  - Accidentally routing `Du an` to the old `projects` placeholder.
  - Breaking task detail hash/back-to-board behavior by over-renaming `kanban`.
  - Over-renaming internal `workspacePath` terminology and breaking backend contracts.

- **Evidence Required:**
  - Test output for `npm run build` and `npm test`.
  - Screenshot or DOM evidence showing sidebar order and active state after clicking `Du an`.
  - Screenshot or DOM evidence showing active state after clicking `Cong viec`.
  - Brief search result or statement confirming no unintended user-facing `Workspace` label remains in the main project/task screen.

## 9. Do Not Do

- Do not implement new project-management features.
- Do not create or require a new backend route/API.
- Do not rename `workspacePath` or filesystem workspace concepts.
- Do not rename every `kanban` occurrence as a broad refactor.
- Do not leave `Du an` pointing at placeholder content.
- Do not leave both `Du an` and `Cong viec` active at the same time.
