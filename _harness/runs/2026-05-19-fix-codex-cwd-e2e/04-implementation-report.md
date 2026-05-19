# Implementation Report

## META_INFORMATION
- **Run_ID**: 2026-05-19-fix-codex-cwd-e2e
- **Agent_Role**: harness_generator
- **Status**: BLOCKED
- **Decision**: BLOCKED
- **Next_Role**: harness_generator_reviewer

## Contract Summary
- Sửa default runner cho `codex exec` để không truyền option `--cwd` không còn hợp lệ.
- Giữ hành vi process chạy tại `task.workspacePath` thông qua `spawn` working directory.
- Truyền prompt theo CLI hiện tại bằng stdin thay vì option `--prompt-file` không còn hợp lệ.
- Bổ sung regression coverage cho default command path và E2E API an toàn bằng runner shim.

## RED
- Phát hiện hiện trạng trong `src/runner.mjs`: `buildRunnerCommand(...)` tạo default args gồm `--cwd` và `path.resolve(task.workspacePath)`.
- Test hiện hữu không bắt lỗi này vì các đường chạy đều override `options.args`.
- Đã thêm regression test trước khi sửa implementation:
  - `tests/task-dispatch.test.mjs`: kiểm tra default args của `buildRunnerCommand(...)`.
  - `tests/server-api.test.mjs`: chạy `POST /api/tasks/:id/run` với shim mô phỏng `codex` mới, reject nếu nhận `--cwd`, đồng thời assert `process.cwd()` đúng workspace.
- Khi chạy E2E thật với `codex-cli 0.131.0`, phát hiện thêm default args cũ còn dùng `--prompt-file`; CLI hiện tại báo `unexpected argument '--prompt-file' found`. `codex exec --help` cho biết prompt phải truyền bằng positional prompt hoặc stdin (`-`).
- Bằng chứng RED:
  - Command: `npm test`
  - Kết quả: FAIL, 4 pass / 2 fail.
  - Lỗi chính:
    - Unit test thấy actual args chứa `--cwd` và workspace path.
    - API E2E trả task status `Failed` thay vì `Done` vì shim reject `unexpected argument '--cwd' found`.
  - Command: real API E2E with `codex`
  - Kết quả: FAIL do `unexpected argument '--prompt-file' found`.

## GREEN
- Sửa tối thiểu tại `src/runner.mjs`:
  - Default args đổi từ `['exec', '--full-auto', '--cwd', workspace, '--prompt-file', promptFile]`
  - Thành `['exec', '--full-auto', '-']`
- Giữ nguyên `cwd: path.resolve(task.workspacePath)` trong runner object, nên `spawn(...)` vẫn thực thi trong workspace của task.
- Thêm `runner.stdin = prompt` cho default runner và `executeProcess(...)` ghi stdin vào child process.
- Giữ artifact `prompt.txt` và ghi marker `stdin: '<prompt>'` trong `command.json` để audit command mà không duplicate prompt lớn trong JSON.

## REFACTOR
- Không cần refactor lớn; thay đổi chỉ nằm ở runner command construction và stdin handoff trong `executeProcess(...)`.
- Test mới dùng API public hiện hữu và temporary executable shim, không thay đổi API contract hoặc data model.

## Verification Evidence
- Command: `npm test`
  - Result: PASS
  - Summary: 6 tests, 6 pass, 0 fail.
  - Coverage behavior:
    - Default command args không chứa `--cwd`.
    - Default command args không chứa `--prompt-file`.
    - Default command args dùng stdin sentinel `-` và `command.json` ghi `stdin: '<prompt>'`.
    - API run tạo task từ `Assigned` sang `Done`.
    - Task có `sessionRef`, `processRef`, `runArtifactPath`.
    - `command.json` ghi nhận args không có `--cwd`.
    - Shim quan sát `process.cwd()` đúng `workspacePath`.
    - `stderr.log` không chứa `unexpected argument '--cwd' found`.
- Command: `npm run build`
  - Result: PASS
  - Output: `Static asset check passed`
- Command: real API E2E with `codex-cli 0.131.0` in isolated `/tmp` workspace
  - Result: BLOCKED by environment authentication, not by runner arguments.
  - Observed command artifact: `command: "codex"`, `args: ["exec", "--full-auto", "-"]`, `cwd: <isolated workspace>`, `stdin: "<prompt>"`.
  - Assertion result: no `--cwd`, no `--prompt-file`, cwd equals resolved task workspace, stderr has neither `unexpected argument '--cwd' found` nor `unexpected argument '--prompt-file' found`.
  - Blocking stderr: `401 Unauthorized: Missing bearer or basic authentication in header`.
  - Task status: `Failed` because Codex CLI could not authenticate against the OpenAI API.

## Files Changed
- `src/runner.mjs`
- `tests/task-dispatch.test.mjs`
- `tests/server-api.test.mjs`
- `_harness/runs/2026-05-19-fix-codex-cwd-e2e/04-implementation-report.md`

## Acceptance Criteria Mapping
- **AC1**: Satisfied by unit regression and API `command.json` assertion that args do not include `--cwd`.
- **AC2**: Satisfied by API shim assertion that `process.cwd()` equals resolved `workspacePath`.
- **AC3**: Satisfied for shim/API E2E, but real Codex E2E is BLOCKED by missing CLI authentication (`401 Unauthorized`) before the task can reach `Done`.
- **AC4**: Satisfied by `npm test` PASS and regression test that fails if `--cwd` is reintroduced.

## Blocker
- Real Codex E2E cannot be fully marked PASS in this environment because `codex exec` returns `401 Unauthorized: Missing bearer or basic authentication in header`.
- This blocker is external to the runner argument/cwd fix. The verified command no longer contains invalid `--cwd` or `--prompt-file`, and process `cwd` is correct.
