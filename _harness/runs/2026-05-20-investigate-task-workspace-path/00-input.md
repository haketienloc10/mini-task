# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-20-investigate-task-workspace-path

## 2. RAW_USER_REQUEST
report: hiện tại đã có chức năng tạo project, nhưng khi tạo task lại chọn workspace path riêng được. điều này là không đúng với yêu cầu task trong project. đường dẫn workspace nên nằm trong project. hãy kiểm tra những điểm còn sai sót.

## 3. INTENT_BRIEF
Phát hiện và điều tra các điểm sai sót trong codebase liên quan đến vấn đề: khi tạo task (trong project), người dùng hiện có thể chọn workspace path độc lập (không ràng buộc vào project). Workspace path của task phải nằm trong thư mục của project, không được phép chọn tùy ý ngoài project.

## 4. ADDITIONAL_NOTES
* Đây là nhiệm vụ điều tra/kiểm tra (investigation/report) – chưa cần fix code ngay.
* Cần xem xét toàn bộ luồng: UI form tạo task, logic validate workspace path, cách lưu trữ task, cách hiển thị/sử dụng workspace path của task.
* Cần liệt kê cụ thể các file, function, component liên quan đến vấn đề.
