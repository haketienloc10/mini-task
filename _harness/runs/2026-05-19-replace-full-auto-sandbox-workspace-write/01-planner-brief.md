# [PLANNER_BRIEF_DOCUMENT]

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Phạm vi chỉ là cập nhật tham số gọi Codex CLI mặc định từ option lỗi thời sang option sandbox hiện hành, cùng các test/assertion trực tiếp liên quan. Không yêu cầu thay đổi workflow Harness, UI, API contract, data model, hay cơ chế chạy process ngoài danh sách tham số.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Khi hệ thống build command mặc định để chạy Codex CLI, danh sách args phải dùng `codex exec --sandbox workspace-write -` thay cho `codex exec --full-auto -`. Các test hiện có phải phản ánh hành vi mới và không còn kỳ vọng `--full-auto`.

### 2.2. Context_Summary
> `--full-auto` đã lỗi thời trong Codex CLI hiện tại, nên command mặc định có nguy cơ cảnh báo hoặc lỗi khi dispatch task thật. Repo đang có logic runner và test/assertion nhắc trực tiếp đến option này. Thay đổi cần giữ nguyên ý nghĩa chạy trong workspace với stdin prompt, nhưng chuyển sang cú pháp sandbox rõ ràng.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Cập nhật default Codex runner args để dùng `--sandbox workspace-write`.
- Cập nhật test/assertion liên quan đến default args và artifact `command.json` để khớp hành vi mới.
- Kiểm tra không còn reference `--full-auto` trong các vị trí runtime/test thuộc phạm vi task.

### 3.2. Out_Of_Scope
- Không đổi cơ chế spawn process, stdin prompt, cwd resolution, timeout, session artifact, hay store lifecycle nếu không bắt buộc cho mục tiêu trên.
- Không đổi cấu hình `.codex/agents/*.toml`; các file này đã dùng `sandbox_mode = "workspace-write"` và không phải nguồn của option CLI lỗi thời.
- Không xử lý các thay đổi working tree không liên quan như `AGENTS.md` hoặc run `_harness/runs/2026-05-19-test`.
- Không nâng cấp dependency, đổi package scripts, hoặc refactor runner ngoài phần args cần thiết.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi build default runner command, `runner.args` chính xác là `['exec', '--sandbox', 'workspace-write', '-']`.
- [ ] AC2: Khi task chạy qua API/default command path, fake runner quan sát args mới và artifact `command.json` ghi lại args mới, vẫn giữ `cwd` là workspace resolved path và `stdin` là `<prompt>`.
- [ ] AC3: Các prompt mode hiện có không đổi: subagent mode vẫn có metadata subagent/task, default task mode vẫn là plain prompt và dùng stdin prompt.
- [ ] AC4: Không còn assertion hoặc runtime default nào trong `src/runner.mjs`, `tests/task-dispatch.test.mjs`, `tests/server-api.test.mjs` kỳ vọng `--full-auto`.
- [ ] AC5: `npm test` pass sau thay đổi; nếu có build/static check liên quan trong quy trình local thì `npm run build` cũng pass.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `src/runner.mjs`
- **Page_API**: `POST /api/tasks/:id/run` chỉ bị ảnh hưởng gián tiếp qua command runner behavior; không đổi API shape.
- **Data_Model**: None
- **Test_Area**: `tests/task-dispatch.test.mjs`, `tests/server-api.test.mjs`

### 5.2. Risks_And_Unknowns
- Codex CLI hiện tại cần cú pháp tách arg đúng: `--sandbox` và `workspace-write` là hai phần tử riêng trong args array.
- Không nên chỉ thay string trong test; cần đảm bảo runtime default args và API-observed args cùng đổi.
- Working tree đã có thay đổi không liên quan; Generator phải tránh sửa hoặc revert các file ngoài phạm vi.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Điểm runtime chính đã thấy là `buildRunnerCommand()` trong `src/runner.mjs`, default branch đang trả `args: ['exec', '--full-auto', '-']`.
- Các assertion trực tiếp đã thấy nằm trong `tests/task-dispatch.test.mjs` và `tests/server-api.test.mjs`; cập nhật kỳ vọng sang `['exec', '--sandbox', 'workspace-write', '-']`.
- Giữ nguyên các assertion hiện có về không dùng `--cwd`, không dùng `--prompt-file`, `cwd`, `stdin`, và prompt content để tránh mở rộng scope.
- Sau implement, chạy tối thiểu `npm test`; nên chạy thêm `npm run build` vì package có script build nhẹ.
