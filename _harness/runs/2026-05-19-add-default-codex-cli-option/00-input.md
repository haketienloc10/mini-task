# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-19-add-default-codex-cli-option

## 2. RAW_USER_REQUEST
ngoài các subagent đang list ra, hãy thêm 1 lựa chọn là default, có khi dùng lựa chọn này thì không gọi subagent mà thực chỉ truyền prompt thuần túy tới codex cli.

## 3. INTENT_BRIEF
Thêm lựa chọn `default` bên cạnh danh sách subagent hiện có; khi chọn `default`, hệ thống không gọi subagent mà truyền prompt thuần túy tới `codex cli`.

## 4. ADDITIONAL_NOTES
* Coordinator không trực tiếp sửa source/project files ngoài artifact điều phối theo contract hiện tại.
* Yêu cầu có thể cần Planner xác định vị trí danh sách lựa chọn subagent và cách biểu diễn fallback `default` trong workflow/config/UI liên quan.
