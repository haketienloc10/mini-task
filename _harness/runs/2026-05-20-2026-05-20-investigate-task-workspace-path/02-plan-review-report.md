# [PLAN_REVIEW_REPORT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt cấu trúc dưới đây. Chỉ điền thông tin vào trong ngoặc vuông `[...]`. Không thêm văn bản phụ trợ hay lời chào. Nếu không có dữ liệu, hãy điền `None`.

## 1. META_INFORMATION
- **Status**: APPROVED
- **Reviewed_Files**:
  - `01-planner-brief.md`
- **Next_Role**: GENERATOR

## 2. EXECUTIVE_SUMMARY
> Kế hoạch được xây dựng rõ ràng, đúng phạm vi, và đã xác định chính xác các điểm cần thay đổi trong codebase thực tế (đã xác minh qua code review). Không có blocking issue. Các pitfall kỹ thuật quan trọng (async refactor, path normalization, backward-compat) đã được nhận diện và có chiến lược xử lý cụ thể.

## 3. ACTION_ITEMS
### 3.1. Required_Changes
- None

### 3.2. Blocking_Issues
- None

### 3.3. Suggestions
- Generator nên dùng `path.resolve()` để normalize cả hai đường dẫn trước khi so sánh `startsWith`, tránh edge case trailing slash.
- Cân nhắc thêm unit test riêng cho logic validate sub-path trong `validateTaskInput` (test case: đường dẫn hợp lệ, không hợp lệ, project chưa có workspacePath).

## 4. ROLE_HANDOFF
### Notes_For_Next_Role
- Bắt đầu từ `src/taskStore.mjs`: thêm `workspacePath` vào `createProject()` và validate sub-path trong `createTask()`.
- Tiếp theo `src/server.mjs`: refactor `validateTaskInput` từ sync → async, truyền thêm `store` vào hàm, fetch project và kiểm tra sub-path constraint; cập nhật call site tại dòng 42 thành `await validateTaskInput(body, store)`.
- Tiếp theo `public/index.html`: thêm input `workspacePath` vào `#projectForm`.
- Tiếp theo `public/app.js`: cập nhật handler `projectForm.submit` để truyền `workspacePath`; cập nhật `#taskProjectSelect change` để hiển thị prefix và ghép đường dẫn đầy đủ khi submit task form.
- Cuối cùng `tests/server-api.test.mjs`: cập nhật test setup để tạo project với `workspacePath` và đảm bảo task workspace là sub-path.
- Nếu `project.workspacePath` là falsy (project cũ chưa có trường này), **bỏ qua** constraint để đảm bảo backward-compatibility.