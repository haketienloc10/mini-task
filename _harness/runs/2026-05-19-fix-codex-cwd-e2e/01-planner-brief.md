# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Phạm vi chỉ giới hạn ở lỗi khởi chạy task qua runner khi gọi `codex exec`; không yêu cầu thay đổi mô hình dữ liệu, UI flow, hoặc workflow Harness.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Sửa luồng chạy task để không truyền option `--cwd` không còn hợp lệ cho `codex exec`, trong khi process vẫn thực thi tại `workspacePath` của task. Sau khi sửa, kiểm thử unit/API và một luồng E2E tạo/chạy task phải chứng minh không còn lỗi `unexpected argument '--cwd' found`.

### 2.2. Context_Summary
> Người dùng đã start app, chạy thử một task và gặp lỗi từ CLI vì `codex exec` hiện tại không chấp nhận `--cwd`. App đã có cơ chế truyền `cwd` cho child process, nên hành vi chạy trong workspace cần được giữ bằng cơ chế process working directory thay vì CLI option đã lỗi thời. Cần bổ sung regression coverage để lỗi này không tái diễn khi default runner command được build.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Điều chỉnh runner command mặc định cho `codex exec` để loại bỏ option `--cwd` không hợp lệ.
- Giữ nguyên hành vi process chạy trong `task.workspacePath` bằng `spawn` working directory.
- Bổ sung hoặc cập nhật test để xác nhận default runner args không chứa `--cwd` và `cwd` vẫn trỏ tới workspace đã resolve.
- Chạy kiểm thử hiện có và một luồng E2E tạo task, run task, kiểm tra task hoàn tất/không còn stderr lỗi `unexpected argument '--cwd' found`.
- chạy một task Codex thật không có khả năng sửa source trong workspace như một phần bắt buộc của E2E. Nếu cần thiết hãy connect chrome-dev-tool để thực hiện E2E thật sự.

### 3.2. Out_Of_Scope
- Không thay đổi UI/UX ngoài những gì bắt buộc để task run thành công.
- Không thay đổi cấu trúc dữ liệu task, artifact layout, hoặc API contract nếu không cần thiết.
- Không nâng cấp/thay thế Codex CLI, không đổi cơ chế subagent, không refactor runner tổng thể.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi người dùng chạy một task từ app/API với default runner, command artifact không còn ghi nhận argument `--cwd` trong danh sách args.
- [ ] AC2: Task vẫn được thực thi với working directory là `workspacePath` đã resolve của task, nên runner/shim quan sát được cwd đúng.
- [ ] AC3: Một task hợp lệ có thể chuyển từ `Assigned` sang `Done`, có `sessionRef`, `processRef`, `stdout.log`/`stderr.log`, và không có stderr chứa `unexpected argument '--cwd' found`.
- [ ] AC4: Các test hiện có vẫn pass, và có regression test mới hoặc test cập nhật fail nếu `--cwd` bị thêm lại vào default `codex exec` args.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `src/runner.mjs`, có thể `scripts/fake-codex-runner.mjs` hoặc test helper nếu cần E2E shim.
- **Page_API**: `POST /api/tasks/:id/run` là đường chạy cần verify; `POST /api/tasks` và `GET /api/tasks/:id` dùng trong E2E setup/assertion.
- **Data_Model**: None
- **Test_Area**: `tests/task-dispatch.test.mjs`, `tests/server-api.test.mjs`, và một E2E/smoke flow chạy app/API end-to-end với runner shim.

### 5.2. Risks_And_Unknowns
- Codex CLI thật có thể thay đổi option khác ngoài `--cwd`; task này chỉ xử lý lỗi được báo cáo và giữ command tối thiểu đang dùng.
- E2E bằng Codex thật có thể gây side effect trong workspace do `--full-auto`; ưu tiên shim/fake runner để verify contract an toàn, rồi chỉ chạy command thật ở chế độ không phá hoại nếu Generator/Evaluator xác định được cách làm an toàn.
- Nếu test hiện tại override `options.args`, cần thêm coverage cho path mặc định vì override path sẽ không bắt regression `--cwd`.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Trong `buildRunnerCommand`, giữ `cwd: path.resolve(task.workspacePath)` và bỏ `--cwd`, `<workspace>` khỏi default args; không bỏ validation workspace.
- Đừng chỉ sửa test bằng `options.args`, vì lỗi thực tế nằm ở default command path khi app dùng `codex`.
- Nên thêm assertion trực tiếp trên `buildRunnerCommand(...)` để command args chứa `exec`, `--full-auto`, `--prompt-file`, `<promptFile>` nhưng không chứa `--cwd`.
- E2E an toàn nên chạy qua API/app với runner shim kiểm tra `process.cwd()` đúng workspace và reject nếu thấy `--cwd`, nhằm mô phỏng CLI mới mà không để Codex thật sửa repo.
- Sau implementation, chạy tối thiểu `npm test` và `npm run build`; nếu có thêm E2E script/test thì chạy script đó và lưu kết quả vào handoff/evidence cho Evaluator.
