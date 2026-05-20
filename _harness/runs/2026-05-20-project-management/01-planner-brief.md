# [PLANNER_BRIEF_DOCUMENT]

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Tác vụ này giới hạn trong việc thêm thực thể Project, tích hợp Project vào Task (bắt buộc), lưu trữ lịch sử chat của Task và cập nhật giao diện web UI để hiển thị. Không thay đổi cơ chế thực thi sandbox hay lõi của Codex CLI.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
Thêm tính năng quản lý Project để phân loại Task (bắt buộc), đồng thời phát triển giao diện Chat Session cho phép người dùng tiếp tục hội thoại với subagent trong ngữ cảnh của Task đó bằng cách gửi tiếp câu hỏi mới vào session chạy tiếp theo.

### 2.2. Context_Summary
Hiện tại, ứng dụng `mini-task` là một bảng điều khiển task cục bộ (one-task-one-session). Task được tạo độc lập và khi chạy chỉ sử dụng mô tả cố định ban đầu. Việc thêm Project giúp quản lý các task ngăn nắp hơn, và tính năng chat session giúp người dùng tương tác liên tục, điều chỉnh công việc linh hoạt thay vì chỉ chạy một lần rồi thôi.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- **Thực thể Project**: Lưu trữ tại `data/projects.json`, hỗ trợ API `GET /api/projects` và `POST /api/projects`.
- **Liên kết Task - Project**: Mỗi Task khi tạo **bắt buộc** phải liên kết với một `projectId` hợp lệ. API `POST /api/tasks` và `src/taskStore.mjs` sẽ yêu cầu và validate trường này (không chấp nhận task tự do).
- **Lịch sử trò chuyện (Chat Session)**: Lưu trữ danh sách `messages` trong cấu trúc dữ liệu của mỗi Task ở `data/tasks.json`. Mỗi message gồm `id`, `sender` ('user' | 'agent'), `content`, `createdAt`.
- **Tích hợp hội thoại vào Runner**: 
  - Khi người dùng gửi thêm tin nhắn mới vào Task, tin nhắn này được thêm vào mảng `messages` với `sender: 'user'`.
  - Hệ thống kích hoạt một lượt chạy mới của subagent thông qua `runTask`. 
  - **Prompt gửi cho Codex**: Chỉ chứa nội dung tin nhắn mới nhất của người dùng (không gộp toàn bộ lịch sử chat để tránh loãng ngữ cảnh). Subagent sẽ tự hiểu bối cảnh dựa trên các thay đổi hiện tại trong workspace từ các lượt chạy trước.
  - Kết quả output (stdout) sau khi chạy xong sẽ được lưu lại dưới dạng một tin nhắn mới của `agent` trong mảng `messages`.
- **Cập nhật Giao diện (Web UI)**:
  - Sidebar hoặc bảng chọn để tạo và chọn Project. Lọc danh sách Task theo Project đang chọn.
  - Chuyển đổi khung chi tiết Task thành giao diện Chat, hiển thị lịch sử hội thoại tuần tự (User & Agent), có Input Chat ở dưới cùng để nhập tin nhắn mới và gửi đi (kích hoạt lượt chạy mới).

### 3.2. Out_Of_Scope
- Quản lý phân quyền người dùng (Authentication/Authorization) hoặc nhiều người dùng đồng thời.
- Sửa đổi cơ chế thực thi sandbox của Codex CLI.
- Lưu trữ file đính kèm hay tệp tin phương tiện trong chat.

## 4. ACCEPTANCE_CRITERIA (AC)
- [ ] AC1: Người dùng có thể tạo một dự án (Project) mới thông qua giao diện UI hoặc API.
- [ ] AC2: Khi tạo Task mới, người dùng bắt buộc phải chọn một Project đang có (không cho phép tạo task không thuộc project).
- [ ] AC3: Giao diện danh sách Task hiển thị các task thuộc Project đang được chọn. Khi chọn Project khác, danh sách Task tự động lọc theo.
- [ ] AC4: Khung chi tiết Task hiển thị lịch sử hội thoại dưới dạng các bong bóng chat tuần tự giữa User (tin nhắn yêu cầu) và Agent (kết quả output/stdout).
- [ ] AC5: Người dùng có thể nhập tin nhắn mới vào ô chat của Task và gửi đi. Hệ thống sẽ lưu tin nhắn User, chạy subagent với prompt là tin nhắn đó trên cùng workspace, và hiển thị output nhận được dưới dạng tin nhắn Agent tiếp theo.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `src/taskStore.mjs`, `src/runner.mjs`, `src/server.mjs`, `public/app.js`, `public/index.html`, `public/styles.css`
- **Page_API**:
  - Thêm mới: `GET /api/projects`, `POST /api/projects`
  - Thay đổi: 
    - `GET /api/tasks`: Lọc task theo `projectId` ở query parameter (hoặc lọc ở client side).
    - `POST /api/tasks`: Bắt buộc nhận `projectId` trong body và kiểm tra tính hợp lệ trong Project Store.
    - `POST /api/tasks/:id/run`: Cho phép nhận body JSON `{ prompt: string }` tùy chọn.
- **Data_Model**:
  - `data/projects.json` (mới): Danh sách project
  - `data/tasks.json` (thay đổi): Thêm `projectId`, thêm mảng `messages` vào mỗi task
- **Test_Area**: Cập nhật các test case trong `tests/server-api.test.mjs` và `tests/task-dispatch.test.mjs` để tương thích với yêu cầu `projectId` và logic chạy session.

### 5.2. Risks_And_Unknowns
- **Trạng thái chạy (Running Status)**: Khi Task đang ở trạng thái 'Running', ô nhập chat và nút gửi tin nhắn mới cần bị vô hiệu hóa để tránh gửi chồng chéo tin nhắn khi subagent chưa hoàn thành lượt chạy trước.
- **Tương thích ngược dữ liệu**: Các task cũ trong `data/tasks.json` chưa có `projectId` và `messages` cần được xử lý an toàn (ví dụ: tạo mặc định mảng `messages` chứa mô tả ban đầu, và gán một project mặc định hoặc xử lý lỗi êm đẹp).

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator

#### 6.1. Hướng dẫn thiết kế chi tiết cho API
1. **Quản lý Project (`src/taskStore.mjs` và `src/server.mjs`)**:
   - Viết class `ProjectStore` hoặc tích hợp vào `TaskStore`. Tốt nhất là thêm các phương thức: `listProjects()`, `getProject(id)`, `createProject({ name, description })` vào `TaskStore` để quản lý tập trung, lưu ở `data/projects.json`.
   - APIs mới:
     - `GET /api/projects`: Trả về mảng danh sách projects.
     - `POST /api/projects`: Body nhận `{ name, description }`, validate bắt buộc phải có `name` (không được trống).
   - API `POST /api/tasks` cập nhật:
     - Nhận `projectId` từ body.
     - Validate: Kiểm tra `projectId` có tồn tại trong dữ liệu projects không. Nếu không, trả về lỗi `400` với thông báo hợp lý.
     - Dữ liệu Task mới khởi tạo: Thêm trường `projectId`, và mảng `messages: []`.

2. **Cơ chế Run Task & Chat Session (`src/runner.mjs`, `src/taskStore.mjs` & `src/server.mjs`)**:
   - Cập nhật API `POST /api/tasks/:id/run`:
     - API này có thể nhận body tùy chọn: `{ prompt: string }`.
     - Nếu có `prompt` trong body:
       - Tạo tin nhắn User mới: `{ id: randomUUID(), sender: 'user', content: prompt, createdAt: now }` và push vào mảng `task.messages`.
       - Sau đó gọi `runTask` với prompt mới này.
     - Nếu không có `prompt` trong body:
       - Kiểm tra nếu `task.messages` trống (chạy lần đầu), tự động tạo tin nhắn User đầu tiên bằng `task.description` (và `task.notes` nếu có): `{ id: randomUUID(), sender: 'user', content: description + notes, createdAt: now }`, lưu vào `task.messages`.
       - Gọi `runTask` với prompt này.
   - Cập nhật hàm `runTask` trong `src/runner.mjs`:
     - Cho phép hàm `runTask` nhận một đối số `customPrompt` tùy chọn (truyền qua options hoặc trực tiếp). Nếu có `customPrompt`, nó sẽ dùng `customPrompt` làm prompt gửi cho subagent, thay vì luôn gọi `buildPrompt(task, subagent)`.
     - Sau khi subagent chạy xong (kết quả thành công hoặc thất bại, lấy `result.stdout` hoặc lỗi):
       - Tạo tin nhắn Agent: `{ id: randomUUID(), sender: 'agent', content: result.stdout || error.message, createdAt: finishedAt }` và push vào mảng `task.messages`.
       - Cập nhật lại Task trong store.

#### 6.2. Hướng dẫn thiết kế chi tiết cho Frontend (`public/`)
1. **Bố cục Web UI (`index.html`, `styles.css`)**:
   - Chia màn hình thành 3 cột (Sidebar Projects - Cột giữa Tasks - Cột phải Chat Detail).
   - Sidebar Projects: hiển thị danh sách các project, một nút "New Project" để hiện popup/form nhập Name, Description của project mới.
   - Cột giữa Tasks: chỉ hiển thị danh sách Task thuộc project đang active. Thêm một dropdown hoặc tự chọn Project đang active làm mặc định khi tạo Task mới.
2. **Khung Chat Detail (`app.js`)**:
   - Khi chọn một Task, hiển thị lịch sử hội thoại từ `task.messages` thay vì giao diện chi tiết cũ.
   - Cấu trúc tin nhắn:
     - Tin nhắn `user` hiển thị bên phải, màu nền xanh/tím sáng (glassmorphism style).
     - Tin nhắn `agent` hiển thị bên trái, màu nền tối/xám nhạt, sử dụng thẻ `<pre>` để giữ nguyên font chữ monospace và định dạng kết quả code/stdout của subagent.
   - Phía dưới cùng của khung chat: Thêm ô nhập tin nhắn dạng `<input>` hoặc `<textarea>` và nút "Send".
   - Logic hoạt động:
     - Khi bấm "Send" hoặc ấn Enter: gọi `POST /api/tasks/:id/run` với body `{ prompt: text }`.
     - Trong khi đang chạy, hiển thị trạng thái đang gửi/đang chạy (disable ô input và nút Send).
     - Sau khi API trả về kết quả, tải lại danh sách task và scroll khung chat xuống cuối.