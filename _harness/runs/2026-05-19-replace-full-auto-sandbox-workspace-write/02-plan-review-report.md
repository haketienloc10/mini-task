# [PLAN_REVIEW_REPORT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt cấu trúc dưới đây. Chỉ điền thông tin vào trong ngoặc vuông `[...]`. Không thêm văn bản phụ trợ hay lời chào. Nếu không có dữ liệu, hãy điền `None`.

## 1. META_INFORMATION
- **Status**: APPROVED
- **Reviewed_Files**:
  - `_harness/instructions/bootstrap.md`
  - `_harness/config.yaml`
  - `_harness/runs/2026-05-19-replace-full-auto-sandbox-workspace-write/01-planner-brief.md`
  - `_harness/runs/2026-05-19-replace-full-auto-sandbox-workspace-write/00-input.md`
- **Next_Role**: GENERATOR

## 2. EXECUTIVE_SUMMARY
> Plan đủ rõ, đúng intent gốc và có phạm vi hẹp cho việc thay option Codex CLI lỗi thời. Acceptance Criteria đo được, có điểm runtime/test cụ thể, và có cảnh báo tránh đụng working tree không liên quan. Đủ điều kiện chuyển sang Generator.

## 3. ACTION_ITEMS
### 3.1. Required_Changes
- None

### 3.2. Blocking_Issues
- None

### 3.3. Suggestions
- Generator nên giữ đúng scope đã nêu: chỉ cập nhật default args và assertion liên quan, không đổi spawn/cwd/stdin/session lifecycle.
- Sau thay đổi, chạy `npm test`; nếu môi trường local cho phép, chạy thêm `npm run build`.

## 4. ROLE_HANDOFF
### Notes_For_Next_Role
- Cập nhật runtime default trong `src/runner.mjs` từ `['exec', '--full-auto', '-']` sang `['exec', '--sandbox', 'workspace-write', '-']`.
- Cập nhật assertion trực tiếp trong `tests/task-dispatch.test.mjs` và `tests/server-api.test.mjs` để phản ánh args mới.
- Giữ nguyên các assertion về `cwd`, `stdin`, prompt content, và không dùng `--cwd` hoặc `--prompt-file`.
- Không sửa hoặc revert các thay đổi working tree ngoài phạm vi run này.
