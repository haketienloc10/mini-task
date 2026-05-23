# Execution Handoff

## Goal

- Nâng cấp giao diện hiện tại từ task board đơn giản thành giao diện quản lý project, task, agent chuyên nghiệp hơn.
- Outcome chính là một project command center có workflow rõ: chọn project, theo dõi task theo trạng thái, xem agent capacity, và mở chi tiết task theo selection.

## Accepted Outcome

- User đã xác nhận preview `project-task-agent-command-center-preview.html` là đúng hướng.
- Giao diện mặc định không hiển thị cố định `Selected Task` bên phải.
- `Task Board` chiếm toàn bộ vùng chính khi chưa chọn task.
- Khi user click một task, panel bên phải mới hiện ra để hiển thị chi tiết task và context liên quan.
- Panel bên phải có thể ẩn lại bằng nút `Close`, đồng thời bỏ selected state của task.
- Text trong các cột `Backlog`, `Ready`, `Running`, `Done` không được tràn ra ngoài hoặc đè lên nhau.

## Confirmed Artifact / Evidence Direction

- Preview artifact: `previews/project-task-agent-command-center-preview.html`
- Handoff artifact: `previews/project-task-agent-command-center-handoff.md`
- Evidence sau implementation nên gồm:
  - mở app thật và kiểm tra flow chọn task / đóng detail panel;
  - kiểm tra responsive layout ở desktop và mobile;
  - chạy test hiện có nếu thay đổi frontend không phá API/task lifecycle;
  - kiểm tra không có text overlap trong task board.

## Scope

In scope:

- Cải thiện layout frontend quản lý project/task/agent.
- Sidebar project chuyên nghiệp hơn: project list, workspace path, task/agent count hoặc equivalent từ dữ liệu hiện có.
- Main task board theo trạng thái: `Backlog`, `Ready`, `Running`, `Done` hoặc mapping hợp lý từ status hiện tại.
- Task card rõ title, status/type, mô tả ngắn, agent, priority/time metadata nếu dữ liệu hỗ trợ.
- Contextual right panel chỉ hiện khi có selected task.
- Nút đóng panel để quay lại board full-width.
- Agent capacity panel và activity/context panel có thể dùng dữ liệu hiện có hoặc state tổng hợp đơn giản.
- Giữ API contracts hiện tại nếu không có lý do bắt buộc phải đổi.

Out of scope:

- Không tự mở rộng backend phức tạp nếu UI có thể dùng dữ liệu hiện có.
- Không thêm hệ thống permission, multi-user, notification thật, realtime socket, drag-and-drop thật nếu chưa được yêu cầu.
- Không refactor lớn ngoài phần cần thiết cho UI outcome.
- Không thay đổi runner/subagent lifecycle nếu không cần.

## Acceptance Criteria

- Khi chưa chọn task, `Selected Task` panel không hiện và task board dùng toàn bộ chiều ngang vùng content.
- Khi click một task, panel bên phải hiện ra với thông tin đúng của task đó.
- Task được chọn có visual state rõ ràng.
- Khi bấm `Close`, panel bên phải biến mất và selected state được clear.
- Task board không có text overflow/overlap ở các card trong `Backlog`, `Ready`, `Running`, `Done`.
- Project selection vẫn lọc task đúng theo project.
- Tạo project và tạo task vẫn hoạt động như hiện tại.
- Chạy task/subagent từ task detail vẫn hoạt động hoặc có flow tương đương rõ ràng.
- Layout không vỡ ở mobile; nếu panel không đủ chỗ, nó stack bên dưới board hoặc trở thành drawer phù hợp.

## Required Evidence

- Screenshot hoặc manual check desktop:
  - default state chưa chọn task;
  - state sau khi click task;
  - state sau khi close panel.
- Manual check mobile/responsive.
- Output test command nếu có test liên quan, ưu tiên test hiện có trong repo.
- Nếu không chạy được test, ghi rõ lý do.

## Constraints

- Trả lời và ghi chú bằng tiếng Việt theo AGENTS.md.
- Giữ technical terms, code, commands, file paths, config keys ở dạng gốc.
- Thay đổi surgical, chỉ chạm file cần thiết.
- Không refactor adjacent code hoặc cleanup ngoài scope.
- Match style hiện có của app.
- Ưu tiên giải pháp đơn giản, dùng static frontend hiện tại nếu đủ.
- Không thêm abstraction/configurability không cần thiết.

## Open Questions

- Có cần mapping status hiện tại `Created`, `Assigned`, `Running`, `Done`, `Failed`, `Cancelled` sang board columns cụ thể không?
- `Backlog` và `Ready` có cần là status thật trong data model, hay chỉ là grouping UI từ status hiện tại?
- Agent capacity dùng dữ liệu thật từ tasks/subagents hay hiển thị tổng hợp best-effort từ task list hiện có?

## Notes for Executor

- Preview/model đã được user xác nhận.
- `grill-me` không implement.
- Không mở rộng scope ngoài phần đã xác nhận.
- Nếu phát hiện mâu thuẫn mới trong execution, dừng lại và báo `BLOCKED` thay vì tự quyết.
