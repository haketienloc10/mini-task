# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Phạm vi chỉ xoay quanh quan hệ project/task và nguồn dữ liệu `workspacePath` khi tạo project, tạo task và chạy task; không yêu cầu refactor kiến trúc, thay đổi subagent execution model, hay redesign UI tổng thể.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Cập nhật behavior để mỗi task bắt buộc thuộc một project, workspace được cấu hình ở project, và task trong project sử dụng chung workspace path của project. Luồng tạo task không còn yêu cầu hoặc nhận workspace path riêng.

### 2.2. Context_Summary
> Hiện hệ thống đã có project management và task đã có `projectId`, nhưng `workspacePath` vẫn đang được nhập/lưu ở task. Yêu cầu mới muốn project là nguồn cấu hình workspace duy nhất cho các task bên trong project. Thay đổi cần được thực hiện ít xâm chiếm nhất, đồng thời vẫn bảo toàn khả năng chạy task và dữ liệu hiện có ở mức hợp lý.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Bổ sung/siết validation để tạo project yêu cầu `workspacePath` hợp lệ về mặt input và lưu workspace path cùng project.
- Điều chỉnh tạo task qua store/API/UI để task bắt buộc có `projectId` hợp lệ nhưng không cần nhập/gửi `workspacePath`.
- Đảm bảo task khi chạy lấy workspace path từ project tương ứng, hoặc được materialize từ project theo cách tối thiểu phù hợp với cấu trúc hiện tại.
- Cập nhật migration/compatibility cho dữ liệu cũ để project mặc định hoặc project hiện hữu không bị thiếu workspace path khi cần chạy task.
- Cập nhật test hiện có và thêm test trọng tâm cho API/store/runner theo behavior mới.

### 3.2. Out_Of_Scope
- Không thêm tính năng edit/delete project hoặc di chuyển task giữa các project.
- Không redesign toàn bộ UI/UX ngoài các field và display cần thiết cho workspace path.
- Không thay đổi danh sách subagent, prompt format, hoặc cơ chế spawn process ngoài phần nguồn `cwd`.
- Không thay đổi command sandbox, run artifact format, hoặc chat/session behavior nếu không bắt buộc bởi workspace source mới.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi tạo project qua UI hoặc `POST /api/projects`, người dùng/API phải cung cấp `workspacePath`; request thiếu hoặc rỗng bị từ chối bằng lỗi validation rõ ràng.
- [ ] AC2: Project được tạo thành công lưu và trả về `workspacePath` đã trim; danh sách/detail dữ liệu project đủ để UI hiển thị hoặc dùng workspace của project.
- [ ] AC3: Khi tạo task qua UI hoặc `POST /api/tasks`, form/payload không còn yêu cầu `workspacePath`; task vẫn bắt buộc có `projectId` hợp lệ, title, description và subagent.
- [ ] AC4: Task mới thuộc project nào thì khi run task sẽ dùng workspace path của project đó làm `cwd`; không dùng workspace path do task client tự gửi lên.
- [ ] AC5: Request tạo task không có `projectId` hoặc dùng `projectId` không tồn tại vẫn bị từ chối.
- [ ] AC6: Dữ liệu legacy có task-level `workspacePath` được xử lý để không phá vỡ migration hiện tại; project mặc định hoặc project liên quan có workspace path đủ để các task cũ tiếp tục chạy trong workspace cũ khi có thể xác định được.
- [ ] AC7: Test tự động bao phủ create project validation, create task không cần workspace path, create task không chấp nhận project không tồn tại, và run task sử dụng workspace path của project.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `src/taskStore.mjs`, `src/server.mjs`, `src/runner.mjs`, `public/index.html`, `public/app.js`
- **Page_API**: `POST /api/projects`, `GET /api/projects`, `POST /api/tasks`, `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks/:id/run`
- **Data_Model**: `projects.json` cần có `workspacePath`; `tasks.json` không nên phụ thuộc vào workspace path mới, nhưng legacy task-level `workspacePath` cần được migration/compatibility xử lý.
- **Test_Area**: `tests/server-api.test.mjs`, `tests/task-dispatch.test.mjs`, static asset/build check nếu frontend markup/script thay đổi.

### 5.2. Risks_And_Unknowns
- Dữ liệu hiện hữu có thể có project đã tạo nhưng chưa có `workspacePath`; Generator cần chọn migration tối thiểu để không làm run task hỏng sau deploy.
- Nếu task object hiện đang được nhiều chỗ giả định có `workspacePath`, thay đổi quá mạnh có thể tạo regression; ưu tiên một đường compatibility rõ ràng cho runner và API response.
- Có ẩn số về kỳ vọng hiển thị workspace ở task list/detail sau thay đổi; xử lý tối thiểu là hiển thị workspace effective từ project hoặc thông tin project liên quan, không cần redesign.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Giữ thay đổi nhỏ: ưu tiên mở rộng schema project với `workspacePath`, cập nhật validation và các test hiện có thay vì viết lại store/API.
- Không để client-controlled `workspacePath` trong `POST /api/tasks` quyết định `cwd`; source of truth phải là project được lookup bằng `projectId`.
- Kiểm tra kỹ migration trong `TaskStore.init()`: default project hiện được tạo cho legacy tasks nhưng chưa có `workspacePath`, nên cần populate từ legacy task khi có thể.
- Sau implement nên chạy `npm test` và `npm run build`; nếu sửa UI nhiều hơn mức tối thiểu thì kiểm tra thủ công flow create project -> create task -> run task.
