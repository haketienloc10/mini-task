# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Phạm vi thay đổi giới hạn trong 3 layer rõ ràng: (1) data model Project, (2) backend API + validator, (3) frontend form. Không ảnh hưởng đến logic runner hay subagent.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Enforce quan hệ phân cấp Project → Task bằng cách buộc `workspacePath` của Task phải nằm trong `workspacePath` của Project cha. Người dùng không còn được phép nhập đường dẫn tùy ý ngoài phạm vi project.

### 2.2. Context_Summary
> Hiện tại, Project không có trường `workspacePath`; Project chỉ lưu `id`, `name`, `description`. Form tạo Task có một input text tự do cho `workspacePath`, cho phép người dùng nhập bất kỳ đường dẫn nào. Backend validator (`validateTaskInput` trong `server.mjs`) chỉ kiểm tra sự tồn tại của trường (non-empty) mà hoàn toàn không kiểm tra xem đường dẫn đó có nằm trong directory của project hay không. `TaskStore.createTask()` cũng không thực hiện bất kỳ ràng buộc nào về scope đường dẫn so với project.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Thêm trường `workspacePath` vào data model và API tạo Project (`createProject` trong `taskStore.mjs`, form `#projectForm` trong `index.html`, handler `projectForm.submit` trong `app.js`)
- Thêm validation trong `validateTaskInput` (`server.mjs`) để kiểm tra `task.workspacePath` phải là sub-path của `project.workspacePath` tương ứng
- Thêm validation tương tự trong `TaskStore.createTask()` (`taskStore.mjs`)
- Cập nhật frontend form tạo Task: xóa input text `workspacePath` tự do; thay bằng prefix hiển thị `workspacePath` của project đã chọn + input bổ sung cho sub-path tương đối
- Cập nhật `app.js`: khi người dùng chọn project trong task form, tự động điền prefix path của project; ghép đường dẫn đầy đủ trước khi gửi lên API
- Cập nhật migration trong `TaskStore.init()` nếu cần (project mặc định `default-project` chưa có `workspacePath`)

### 3.2. Out_Of_Scope
- Validation rằng đường dẫn thực sự tồn tại trên filesystem (chỉ validate chuỗi string, không stat)
- Thay đổi logic runner (`runner.mjs`) hay subagent dispatch
- Thay đổi giao diện hiển thị task detail (chỉ cần giữ hiển thị `workspacePath` như hiện tại)
- Kiểm tra quyền truy cập filesystem

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi tạo Project mới, người dùng bắt buộc phải nhập `workspacePath`; project được lưu với trường `workspacePath` hợp lệ.
- [ ] AC2: Khi mở form tạo Task, trường workspace path hiển thị prefix path của project đang chọn và không cho phép nhập đường dẫn vượt ra ngoài prefix đó.
- [ ] AC3: Khi gửi POST `/api/tasks` với `workspacePath` không nằm trong `workspacePath` của project, server trả về HTTP 400 với thông báo lỗi rõ ràng.
- [ ] AC4: Khi gửi POST `/api/tasks` với `workspacePath` hợp lệ (là sub-path của project workspace), task được tạo thành công với `workspacePath` đầy đủ được lưu.
- [ ] AC5: Các test hiện tại trong `tests/server-api.test.mjs` vẫn pass (hoặc được cập nhật tương ứng nếu thay đổi hành vi tạo project).

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `src/taskStore.mjs` (createProject, createTask), `src/server.mjs` (validateTaskInput, POST /api/projects handler)
- **Page_API**: `POST /api/projects`, `POST /api/tasks`, `GET /api/projects`
- **Data_Model**: Schema của Project trong `data/projects.json` (thêm trường `workspacePath`); project `default-project` được tạo khi migration cần được xử lý (không có workspacePath)
- **Test_Area**: `tests/server-api.test.mjs` — các test tạo project và task cần truyền `workspacePath` cho project và đảm bảo task workspace là sub-path

### 5.2. Risks_And_Unknowns
- **Migration risk**: Project đã tồn tại trong `data/projects.json` (ví dụ project "RAG") và project ảo `default-project` không có trường `workspacePath`. Cần quyết định chiến lược: (a) bắt buộc migration fail-safe với `workspacePath` rỗng và bỏ qua validation nếu project chưa có path, hoặc (b) yêu cầu user cập nhật thủ công. Khuyến nghị: option (a) — nếu `project.workspacePath` là empty/null thì bỏ qua constraint để backward-compatible.
- **Path normalization**: Cần chuẩn hóa trailing slash và case sensitivity khi so sánh path (dùng `path.resolve` và `startsWith`). Ví dụ: `/home/locdt` và `/home/locdt/` cần được xử lý nhất quán.
- **Unknown**: Chưa rõ liệu `runner.mjs` có dùng `workspacePath` theo cách nào có thể bị ảnh hưởng hay không (cần Generator kiểm tra thêm).

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Thêm trường `workspacePath` (string, required) vào `createProject()` trong `taskStore.mjs`; đồng thời thêm trường này vào form HTML `#projectForm` và handler `projectForm.submit` trong `app.js`.
- Trong `validateTaskInput()` tại `server.mjs`: sau khi xác nhận `projectId` tồn tại, fetch project và kiểm tra `task.workspacePath.startsWith(project.workspacePath + path.sep)` hoặc `task.workspacePath === project.workspacePath`. Chú ý dùng `path.resolve` để normalize trước khi so sánh. Nếu `project.workspacePath` là falsy, bỏ qua constraint (backward-compatible).
- Trong `TaskStore.createTask()` tại `taskStore.mjs`: thực hiện cùng validation ở tầng store để đảm bảo integrity ngay cả khi gọi trực tiếp không qua HTTP handler.
- Trong frontend `app.js`: khi `#taskProjectSelect` thay đổi (event `change`), tự động cập nhật placeholder hoặc prefix của trường workspace path để người dùng thấy được prefix của project. Khi submit form, đảm bảo đường dẫn được ghép đầy đủ (nếu dùng approach prefix + relative sub-path).
- **Pitfall**: `validateTaskInput` hiện tại là hàm synchronous (`function validateTaskInput(body)`), nhưng để fetch project data nó sẽ cần trở thành async. Cần refactor call site tại dòng 42-43 trong `server.mjs` thành `await validateTaskInput(body, store)`.
- **Pitfall**: Khi tạo task qua tests, các test hiện tạo project trước mà không truyền `workspacePath`. Cần cập nhật test setup để truyền `workspacePath` cho project và đảm bảo task workspace là sub-path tương ứng.