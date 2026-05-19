# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Scope chỉ giới hạn ở việc thêm lựa chọn `default` vào danh sách lựa chọn hiện có và điều chỉnh đường build prompt khi chạy task; không thay đổi kiến trúc session runner, lifecycle task, persistence, hay workflow Harness.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Thêm lựa chọn `default` bên cạnh các subagent hiện có. Khi task chọn `default`, hệ thống vẫn chạy một Codex CLI session riêng nhưng không prepend thông tin subagent/role vào prompt gửi cho CLI.

### 2.2. Context_Summary
> App hiện cho người dùng chọn một subagent cấu hình sẵn rồi runner build prompt có dòng `Subagent: <role>`. Người dùng muốn có thêm một lựa chọn để dùng Codex CLI theo kiểu thông thường, tức gửi prompt thuần thay vì định tuyến qua subagent chuyên trách. Thay đổi này phải giữ nguyên nguyên tắc một task tương ứng một session Codex độc lập và không mở sang tự động chọn agent.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Thêm option `default` vào danh sách lựa chọn trả về từ `/api/subagents` và hiển thị được trong form tạo task.
- Cho phép tạo, lưu, hiển thị và chạy task với `subagent` hoặc mode tương đương là `default`.
- Điều chỉnh logic build prompt để `default` không sinh dòng `Subagent: ...` hoặc role Harness; prompt gửi tới Codex CLI phải là prompt thuần của task.
- Giữ command/session behavior hiện có: mỗi lần run vẫn tạo process/session riêng, lưu artifact `prompt.txt`, `command.json`, stdout/stderr/log/error như hiện tại.
- Bổ sung/cập nhật test cho danh sách option, validation API, prompt của `default`, và luồng chạy default qua fake/shim runner.

### 3.2. Out_Of_Scope
- Không thêm cơ chế tự động chọn subagent bằng AI.
- Không triển khai workflow nhiều agent nối tiếp hoặc fallback tự động từ subagent sang default.
- Không thay đổi cách gọi Codex CLI mặc định ngoài phần prompt cần gửi vào stdin.
- Không đổi model dữ liệu lớn, database engine, queue runner, authentication, multi-user, hoặc remote execution.
- Không sửa quy tắc Harness Coordinator/subagent trong `_harness/`.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi người dùng mở form tạo task, danh sách lựa chọn có thêm `Default` hoặc nhãn tương đương, bên cạnh Planner, Generator, Reviewer, Evaluator.
- [ ] AC2: Người dùng tạo được task chọn `default`; task được lưu, liệt kê và hiển thị detail với đúng lựa chọn này thay vì bị validation reject.
- [ ] AC3: Khi chạy task chọn `default`, hệ thống tạo một Codex CLI session/process mới như các task khác và task chuyển trạng thái `Running` rồi `Done` hoặc `Failed` theo kết quả process.
- [ ] AC4: Artifact/prompt của task `default` không chứa dòng `Subagent:` và không chứa role như `harness_planner`, `harness_generator`, `harness_plan_reviewer`, hoặc `harness_evaluator`.
- [ ] AC5: Prompt gửi cho Codex CLI ở mode `default` là prompt thuần của task, không bị bọc bằng chỉ thị gọi subagent; title vẫn có thể dùng làm metadata hiển thị nhưng không được biến thành role/subagent instruction.
- [ ] AC6: Task chọn subagent hiện có vẫn giữ hành vi cũ: prompt vẫn có thông tin subagent/role tương ứng và các test hiện có vẫn pass.
- [ ] AC7: API `/api/subagents` và UI label hiển thị `default` nhất quán, không làm vỡ `agentLabel()` hoặc các màn task list/detail.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `src/subagents.mjs`, `src/runner.mjs`, có thể `src/server.mjs` nếu validation cần phân biệt agent option và subagent role rõ hơn.
- **Page_API**: `GET /api/subagents`, `POST /api/tasks`, `POST /api/tasks/:id/run`, UI form/list/detail trong `public/app.js`.
- **Data_Model**: Không cần migration; field task hiện tại `subagent` có thể lưu giá trị `default` nếu được validation chấp nhận.
- **Test_Area**: `tests/task-dispatch.test.mjs`, `tests/server-api.test.mjs`; cần thêm regression cho prompt default và giữ regression command/cwd hiện có.

### 5.2. Risks_And_Unknowns
- Cần tránh đặt `default` như một subagent có `role` rỗng rồi vô tình vẫn sinh dòng `Subagent: undefined` hoặc `Subagent: default`.
- "Prompt thuần" cần được giữ rõ trong implementation: phần mô tả task là nội dung chính gửi vào Codex CLI; nếu dùng notes thì phải coi notes là nội dung người dùng nhập thêm, không phải subagent instruction.
- Nếu đổi tên field từ `subagent` sang field mới như `agentMode`, nguy cơ churn API/UI/test cao; ưu tiên giữ field hiện có để giảm phạm vi.
- Cần bảo đảm thay đổi không làm hỏng backward compatibility với task cũ đã lưu các id subagent hiện tại.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Ưu tiên mô hình nhỏ: thêm option `default` vào cấu hình lựa chọn hiện có và để runner branch theo id `default`; không refactor toàn bộ task model nếu không cần.
- Với `default`, `buildRunnerCommand()` không được gọi là unknown subagent và không được thêm dòng `Subagent:` vào `prompt` hoặc `stdin`.
- Giữ nguyên default args `['exec', '--full-auto', '-']`, `cwd: path.resolve(task.workspacePath)`, và các regression hiện có quanh việc không dùng `--cwd`.
- Thêm test cấp unit cho `buildRunnerCommand()` với `subagent: 'default'` để kiểm tra prompt/stdin, và test API/UI-level đủ để chứng minh `/api/subagents` chứa default và task default chạy qua runner shim.
