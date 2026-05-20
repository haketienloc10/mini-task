# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-20-project-management

## 2. RAW_USER_REQUEST
/grill-me tôi muốn thêm tính năng quản lý project, task sẽ được tạo trong 1 project cụ thể. có thể xem detail của task. có thể tiếp tục trò chuyện trong session của task đó./grill-me

## 3. INTENT_BRIEF
- Thêm tính năng quản lý project, trong đó các task được tạo thuộc về một project cụ thể.
- Hỗ trợ xem chi tiết task.
- Cho phép tiếp tục trò chuyện (session chat) riêng cho từng task.
- Tiến hành chế độ phỏng vấn /grill-me để thống nhất thiết kế.

## 4. ADDITIONAL_NOTES
- Người dùng sử dụng lệnh `/grill-me`.
- Giao tiếp trực tiếp với người dùng bằng tiếng Việt.
- Tài liệu viết ra bằng tiếng Việt.
- Phản hồi từ người dùng (2026-05-20 13:05): Task bắt buộc phải được tạo trong một project cụ thể, không cho phép tạo tự do.
- Phản hồi từ người dùng (2026-05-20 13:06): Không gửi toàn bộ lịch sử chat, chỉ cần gửi tiếp câu hỏi của người dùng vào session cũ của subagent.
- Phản hồi từ người dùng (2026-05-20 13:07): Đồng ý với đề xuất thiết kế Web UI (Sidebar bên trái hiển thị project, cột giữa hiển thị task theo project, cột phải là chat view thay thế task detail) và thiết kế API `POST /api/tasks/:id/run` nhận `prompt` tùy chọn.
