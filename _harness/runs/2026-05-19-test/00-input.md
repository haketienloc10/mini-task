# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-19-test

## 2. RAW_USER_REQUEST
Subagent: harness_evaluator
Task: Test
SAY HELLO

## 3. INTENT_BRIEF
Kích hoạt `harness_evaluator` cho một yêu cầu test đơn giản: phản hồi lời chào.

## 4. ADDITIONAL_NOTES
* Coordinator chỉ truyền `RUN_ID` khi kích hoạt subagent, theo Spawning Protocol.
