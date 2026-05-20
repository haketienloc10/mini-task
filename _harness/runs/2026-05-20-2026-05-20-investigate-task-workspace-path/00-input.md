# [RUN_INPUT_PAYLOAD]

## 1. RUN_METADATA
- **Run_ID**: 2026-05-20-2026-05-20-investigate-task-workspace-path

## 2. RAW_USER_REQUEST
2026-05-20-investigate-task-workspace-path

## 3. INTENT_BRIEF
Điều tra và sửa logic đường dẫn workspace cho Task. Cụ thể: khi tạo Task mới, workspace path phải được tự động scoped vào thư mục của Project cha, không cho phép người dùng tự chọn đường dẫn tùy ý ngoài phạm vi project. Cần audit code hiện tại để xác định chỗ logic bị tách rời, sau đó refactor để workspace của task bị ràng buộc chặt trong sub-directory của project.

## 4. ADDITIONAL_NOTES
* Context từ conversation trước (dbab8ab9-c436-4fbb-8004-eb86f147905e): Task liên quan đến việc enforce quan hệ phân cấp Project → Task, đảm bảo task workspace path luôn nằm trong project directory.
* Cần kiểm tra: form tạo task, service xử lý tạo task, và bất kỳ validator nào liên quan đến workspace path.
* Đây là task điều tra (investigate) — Planner cần xác định rõ phạm vi code cần thay đổi trước khi Generator thực thi.
