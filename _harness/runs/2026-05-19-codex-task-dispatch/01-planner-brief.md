# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Phạm vi được giới hạn ở MVP local single-user cho workflow cốt lõi: tạo task, chọn subagent, chạy một session Codex CLI riêng cho từng task, theo dõi trạng thái, và xem output/log. Các hướng mở rộng như multi-agent workflow, multi-user, remote execution, GitHub integration, queue nâng cao, dashboard thống kê, và tự động chọn agent đều bị loại khỏi MVP.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Xây dựng MVP webapp local "Codex Task Dispatch" cho phép người dùng quản lý task, assign một subagent, chạy task bằng một session Codex CLI độc lập, và xem trạng thái cùng output/log gắn đúng task. MVP phải chứng minh được nguyên tắc "một task, một session" và thay thế được thao tác thủ công mở terminal/copy prompt ở mức cơ bản.

### 2.2. Context_Summary
> Người dùng hiện dùng Codex CLI thủ công cho nhiều loại task như planning, implementation, review, phân tích lỗi, và viết tài liệu. Khi số lượng task tăng lên, việc nhớ command, chọn subagent, theo dõi session, và xem lại output trở nên rời rạc. Webapp này là lớp điều phối phía trên Codex CLI, không thay đổi bản chất Codex CLI và không tự định nghĩa lại hành vi subagent.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Giao diện web local để xem danh sách task, tạo task mới, mở chi tiết task, và xem trạng thái.
- Form tạo task gồm tối thiểu: tiêu đề, mô tả yêu cầu, workspace/project path, subagent được chọn, và ghi chú bổ sung nếu cần.
- Danh sách subagent cấu hình sẵn cho MVP, tối thiểu gồm Planner, Generator, Reviewer, Evaluator, và khả năng mở rộng danh sách sau.
- Chức năng chạy một task đã có nội dung và subagent bằng cách tạo một Codex CLI session mới, riêng biệt cho task đó.
- Lưu metadata task, lifecycle status, thời điểm tạo/bắt đầu/kết thúc, subagent, workspace, command/session reference nếu có, output, log, và error.
- Trạng thái tối thiểu: Created, Assigned, Running, Done, Failed; Cancelled chỉ chuẩn bị mô hình hoặc UI nếu chi phí thấp, chưa cần xử lý hủy process đầy đủ.
- Hiển thị output/log/error trong trang chi tiết task sau hoặc trong khi task chạy, tùy mức khả thi của runtime.
- Verification cho workflow cốt lõi bằng test hoặc script có thể chứng minh task tạo được, assign được, run path cập nhật trạng thái đúng, output/log gắn đúng task, và không reuse session giữa nhiều task.

### 3.2. Out_Of_Scope
- Tự động chia task lớn thành task con.
- Tự động chọn subagent bằng AI.
- Tự động chạy nhiều subagent nối tiếp nhau như Planner -> Generator -> Reviewer -> Evaluator.
- Multi-user, phân quyền, authentication, hoặc team collaboration.
- Remote execution, quản lý nhiều máy chạy agent, hoặc distributed runner.
- Tích hợp GitHub sâu, tạo issue, tạo pull request, hoặc review PR tự động.
- Chat realtime phức tạp với session đang chạy.
- Resume session cũ cho task mới hoặc dùng chung session giữa nhiều task.
- Dashboard thống kê nâng cao, token/cost tracking, workflow template, prompt template nâng cao.
- Thiết kế production deployment; MVP ưu tiên chạy local ổn định.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Người dùng mở webapp và thấy danh sách task với tiêu đề, subagent, workspace/project, trạng thái hiện tại, và thời điểm cập nhật gần nhất.
- [ ] AC2: Người dùng tạo được task mới với tiêu đề, mô tả yêu cầu, workspace/project path, subagent, và task mới xuất hiện ở trạng thái Created hoặc Assigned theo đúng dữ liệu đã nhập.
- [ ] AC3: Người dùng chạy một task đã assign subagent và hệ thống chuyển task sang Running, tạo một Codex CLI session/process riêng cho task đó, rồi cập nhật Done hoặc Failed khi phiên chạy kết thúc.
- [ ] AC4: Khi chạy hai task khác nhau, hệ thống lưu session/process reference hoặc run artifact riêng cho từng task và không dùng chung context/session ngoài ý muốn.
- [ ] AC5: Người dùng mở chi tiết task sau khi chạy và xem được output/log thành công hoặc error message đủ để debug nếu task Failed.
- [ ] AC6: Task detail hiển thị rõ subagent đã xử lý, workspace/project liên quan, thời điểm bắt đầu, thời điểm kết thúc, và trạng thái cuối.
- [ ] AC7: Nếu Codex CLI không tồn tại, command lỗi, workspace không hợp lệ, hoặc process trả exit code lỗi, task phải chuyển sang Failed và lưu lỗi thay vì kẹt ở Running.
- [ ] AC8: Workflow MVP có verification tự động hoặc bán tự động cho create task, assign subagent, run task, status transition, output capture, và session isolation.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: App scaffold, task management UI, task persistence, Codex CLI runner/process orchestration, log/output capture, configuration for subagents/workspaces
- **Page_API**: Task list page, task detail page, task create form, task run action/API, task status/output API or equivalent local app handlers
- **Data_Model**: Task entity with id, title, description, workspacePath, subagent, status, timestamps, session/process/run reference, output, log, error; optional subagent config entity/list
- **Test_Area**: Task CRUD behavior, status lifecycle, runner failure handling, output/log persistence, session isolation across multiple task runs, UI smoke path for create-run-view output

### 5.2. Risks_And_Unknowns
- Codex CLI invocation details, subagent selection syntax, non-interactive execution mode, and expected output stream behavior need confirmation during implementation.
- Running long-lived CLI processes from a local web server can create process cleanup, timeout, concurrency, and log streaming risks; MVP should start with simple bounded execution and explicit Failed handling.
- Workspace path input can be unsafe if accepted blindly; MVP should validate path existence and avoid shell string interpolation.
- Repo currently has no app scaffold, so Generator must choose a minimal local stack and keep it focused on the MVP rather than building a broad platform.
- Real Codex CLI may be difficult to exercise in automated tests; use an injectable runner or fake command for tests while keeping real command path configurable.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Treat this as a local single-user MVP and keep the first implementation thin: task-first UI, durable task store, and a small runner abstraction around Codex CLI.
- Do not implement automatic multi-agent workflows, AI agent selection, remote execution, authentication, GitHub integration, or advanced dashboards in this run.
- Avoid shell injection: pass command arguments as an array through process APIs and validate workspace paths before spawning.
- Make session isolation observable in data, logs, or run directories so Evaluator can verify that two tasks do not share one Codex session.
- If Codex CLI invocation syntax is uncertain, isolate it behind config and provide a fake/test runner path so the MVP behavior can still be verified without relying on a live Codex call.
- Because the repo currently has no app source, prefer a minimal scaffold with clear scripts for dev, build, test, and any runner verification rather than overfitting to a large framework.
