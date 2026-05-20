# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-20-project-task-workspace-requirement

## 2. RAW_USER_REQUEST
issue: hiện tại có thể tạo project và task, yêu cầu task phải thuộc 1 project. project phải có workspace path, task trong project sẽ dùng cùng workspace. khi tạo project phải config thông tin trên. khi tạo task thì không cần thông tin workspace path nữa. hãy sửa giúp tôi. fix đảm bảo. ít xâm chiếm nhất.

## 3. INTENT_BRIEF
Cập nhật behavior tạo project/task: task bắt buộc thuộc một project; project bắt buộc có workspace path khi tạo; task trong project dùng chung workspace path của project; form/API tạo task không cần workspace path nữa. Sửa tối thiểu, đảm bảo bằng test/verification.

## 4. ADDITIONAL_NOTES
* Coordinator không trực tiếp sửa source; triển khai phải đi qua Harness workflow `Planner -> Review Plan -> Generator -> Evaluator`.
* Ưu tiên thay đổi ít xâm chiếm nhất và giữ convention hiện có của repo.
