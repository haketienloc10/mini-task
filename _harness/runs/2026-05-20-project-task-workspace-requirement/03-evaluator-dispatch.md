# [EVALUATOR_DISPATCH]

## 1. ROUTING_METADATA
- **Run_ID**: 2026-05-20-project-task-workspace-requirement
- **From_Role**: Coordinator
- **To_Role**: harness_evaluator
- **Dispatch_Status**: READY

## 2. ALLOWED_READ_PATHS
- `_harness/runs/2026-05-20-project-task-workspace-requirement/00-input.md`
- `_harness/runs/2026-05-20-project-task-workspace-requirement/01-planner-brief.md`
- `_harness/runs/2026-05-20-project-task-workspace-requirement/02-plan-review-report.md`
- `_harness/runs/2026-05-20-project-task-workspace-requirement/04-implementation-report.md`
- `src/taskStore.mjs`
- `src/server.mjs`
- `src/runner.mjs`
- `public/index.html`
- `public/app.js`
- `tests/server-api.test.mjs`
- `tests/task-dispatch.test.mjs`
- `package.json`

## 3. ALLOWED_WRITE_PATHS
- `_harness/runs/2026-05-20-project-task-workspace-requirement/05-evaluator-report.md`

## 4. VERIFICATION_COMMANDS_ALLOWED
- `npm test`
- `npm run build`

## 5. OUTPUT_CONTRACT
- **Evaluator_Report_Path**: `_harness/runs/2026-05-20-project-task-workspace-requirement/05-evaluator-report.md`
