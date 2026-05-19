# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-19-codex-task-dispatch

## 2. RAW_USER_REQUEST
yêu cầu: docs/user-input.md

## 3. INTENT_BRIEF
Phân tích yêu cầu sản phẩm trong `docs/user-input.md` cho MVP webapp "Codex Task Dispatch": tạo task, chọn subagent, mở session Codex CLI riêng cho từng task, theo dõi trạng thái, và xem output/log. Chuyển tiếp sang Planner để lập kế hoạch/contract trước khi có bất kỳ triển khai kỹ thuật nào.

## 4. ADDITIONAL_NOTES
* Coordinator đã đọc `_harness/config.yaml`; `{communication_language}` = Vietnamese, `{document_output_language}` = Vietnamese.
* Nguồn yêu cầu chi tiết nằm tại `docs/user-input.md`.
* Coordinator không trực tiếp sửa mã nguồn hoặc thực thi kỹ thuật; yêu cầu này cần được xử lý qua Harness Planner.
