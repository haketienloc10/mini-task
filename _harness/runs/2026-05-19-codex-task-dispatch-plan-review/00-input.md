# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-19-codex-task-dispatch-plan-review

## 2. RAW_USER_REQUEST
giúp anh lên ý plan và review plan chỉ dừng lại ở bước trên, chưa implement. yêu cầu: docs/user-input.md

## 3. INTENT_BRIEF
Lập plan cho ý tưởng trong `docs/user-input.md`, sau đó review plan. Dừng lại sau bước plan review, không implement.

## 4. ADDITIONAL_NOTES
* Source yêu cầu sản phẩm: `docs/user-input.md`.
* Scope run này chỉ gồm Planner và Plan Reviewer.
* Không thực hiện Generator, không sửa code ứng dụng, không implement.
