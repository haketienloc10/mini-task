# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Scope run này chỉ lập kế hoạch cho MVP webapp điều phối task cho Codex CLI dựa trên `docs/user-input.md`; không implement, không sửa mã nguồn ứng dụng, không tạo test và không chạy Generator.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Lập kế hoạch MVP cho webapp local giúp tạo task, chọn subagent, chạy mỗi task bằng một session Codex CLI riêng, theo dõi trạng thái và xem output/log. Kế hoạch phải đủ rõ để bước triển khai sau có thể bắt đầu mà vẫn giữ đúng phạm vi MVP.

### 2.2. Context_Summary
> Người dùng hiện thao tác Codex CLI thủ công qua terminal, nên khó quản lý nhiều task, session, agent, log và kết quả. Sản phẩm mong muốn là một lớp webapp quản lý phía trên Codex CLI, không thay đổi bản chất Codex CLI và không tự động hóa workflow nhiều bước trong MVP. Nguyên tắc cốt lõi là mỗi task tương ứng với một session Codex độc lập để tránh trộn context. Repo hiện chưa có app source đáng kể, vì vậy kế hoạch triển khai sau cần tính đến việc scaffold nền ứng dụng trước khi xây tính năng.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Xác định luồng MVP: tạo task, chọn workspace/project, chọn một subagent, chạy task, theo dõi trạng thái và xem output/log.
- Xác định các trạng thái task tối thiểu: Created, Assigned, Running, Done, Failed; Cancelled chỉ nên chuẩn bị như hướng mở rộng nếu không làm tăng scope.
- Xác định dữ liệu tối thiểu của task: tiêu đề, mô tả yêu cầu, workspace/project liên quan, subagent được assign, trạng thái, session/job metadata, output/log, lỗi nếu có, thời điểm bắt đầu/kết thúc.
- Xác định yêu cầu session: mỗi lần chạy task phải tạo một Codex CLI session mới, gắn session đó với đúng task và không reuse context giữa các task.
- Xác định bề mặt UI MVP: danh sách task, form tạo/chỉnh task trước khi chạy, selector subagent, action run, màn hình chi tiết task, vùng output/log và trạng thái lỗi.
- Xác định bề mặt backend MVP: lưu task, dispatch Codex CLI process/session riêng, cập nhật trạng thái, thu stdout/stderr/output, ghi nhận lỗi đủ để debug.
- Xác định tiêu chí kiểm thử hành vi cho workflow end-to-end local từ tạo task đến hoàn tất hoặc lỗi.

### 3.2. Out_Of_Scope
- Không implement trong run này.
- Không tự động chia task lớn thành task nhỏ.
- Không tự động chọn subagent bằng AI.
- Không tự động chạy workflow nhiều subagent nối tiếp như Planner -> Generator -> Reviewer -> Evaluator.
- Không hỗ trợ multi-user, phân quyền, remote execution, quản lý nhiều máy chạy agent hoặc team collaboration.
- Không tích hợp GitHub sâu, không tạo pull request tự động.
- Không resume session cũ cho task mới và không dùng chung session giữa nhiều task.
- Không xây dashboard thống kê nâng cao, tracking token/cost hoặc tối ưu chi phí token trong MVP.
- Không xây chat realtime phức tạp với session đang chạy; nếu cần hiển thị log streaming thì chỉ xem là cải tiến phụ sau khi luồng cơ bản ổn định.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Người dùng có thể mở webapp local và thấy danh sách task với trạng thái, subagent, workspace/project liên quan và thời điểm cập nhật đủ để nhận biết task nào chưa chạy, đang chạy, đã xong hoặc lỗi.
- [ ] AC2: Người dùng có thể tạo một task mới với tiêu đề, mô tả yêu cầu, workspace/project và ghi chú tùy chọn; task sau khi tạo được lưu lại ở trạng thái chưa chạy.
- [ ] AC3: Người dùng có thể chọn rõ một subagent cho task trước khi chạy, và task chỉ được gán cho một subagent trong MVP.
- [ ] AC4: Khi người dùng chạy một task hợp lệ, hệ thống tạo một Codex CLI session/process mới dành riêng cho task đó, chuyển task sang Running và lưu metadata đủ để truy vết session thuộc về task nào.
- [ ] AC5: Khi Codex CLI hoàn tất thành công, task chuyển sang Done và người dùng có thể mở task để xem output/log gắn đúng với task đó.
- [ ] AC6: Khi Codex CLI lỗi hoặc không chạy được, task chuyển sang Failed và người dùng có thể xem thông tin lỗi đủ để debug mà không trộn với output của task khác.
- [ ] AC7: Hai task khác nhau khi chạy không dùng chung session/context; output, log và trạng thái của mỗi task được lưu và hiển thị tách biệt.
- [ ] AC8: MVP không yêu cầu người dùng nhớ cú pháp gọi Codex CLI cho luồng cơ bản tạo task -> chọn subagent -> run -> xem kết quả.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: App scaffold, task management, subagent selection, Codex CLI dispatch/session runner, process/log capture, persistence, task detail UI.
- **Page_API**: Task list page, task detail page, create/edit task form, run task action/API, task status/output API, subagent list/config API.
- **Data_Model**: Task, Agent/Subagent option, Workspace/Project reference, Session/Run record, Log/Output/Error fields.
- **Test_Area**: Task CRUD, validation before run, one-task-one-session behavior, status transitions, output/log isolation, Codex CLI failure handling, basic browser workflow.

### 5.2. Risks_And_Unknowns
- Repo hiện gần như chưa có app source, nên bước triển khai sau cần quyết định stack/scaffold phù hợp trước khi code tính năng.
- Cách gọi Codex CLI và cơ chế chọn subagent cần được xác minh bằng command thực tế trong môi trường local trước khi chốt implementation.
- Codex CLI session isolation là yêu cầu cốt lõi; cần test bằng bằng chứng runtime để tránh vô tình reuse process/context.
- Process management có thể phát sinh rủi ro về task chạy lâu, log lớn, crash, timeout hoặc user đóng webapp giữa chừng.
- Persistence MVP cần được chọn đủ đơn giản cho local single-user nhưng vẫn tránh mất mapping task -> session -> output.
- Workspace/project path cần validation để tránh chạy Codex ở sai thư mục hoặc path không tồn tại.
- Hiển thị output/log cần cân bằng giữa đủ debug và không làm UI quá phức tạp trong MVP.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- Khi implementation bắt đầu ở run khác, ưu tiên scaffold tối thiểu nhưng đầy đủ cho webapp local single-user; không kéo scope sang multi-user, workflow automation nhiều bước hoặc GitHub integration.
- Giữ `Task` là trung tâm của UI và data model; command/session chỉ là cơ chế chạy phía sau.
- Thiết kế runner sao cho mỗi action run tạo một Codex CLI session/process mới, có run/session id riêng và mapping rõ với task id.
- Không để hệ thống tự đoán subagent trong MVP; người dùng phải chọn rõ subagent trước khi chạy.
- Cần có failure path first-class: command không tồn tại, workspace sai, agent config sai hoặc Codex CLI exit non-zero đều phải chuyển task sang Failed và lưu lỗi.
- Verification sau triển khai phải có ít nhất một test hoặc evidence chứng minh hai task chạy riêng không trộn output/log/session.
