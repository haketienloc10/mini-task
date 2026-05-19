# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-19-replace-full-auto-sandbox-workspace-write

## 2. RAW_USER_REQUEST
với codex cli hiện tại args `--full-auto` đã lỗi thời, hãy chuyển sang dùng `--sandbox workspace-write`

## 3. INTENT_BRIEF
Cập nhật cấu hình/logic gọi Codex CLI để thay thế option lỗi thời `--full-auto` bằng `--sandbox workspace-write`.

## 4. ADDITIONAL_NOTES
* Phát hiện ban đầu: `src/runner.mjs` và một số test/assertion đang nhắc tới `--full-auto`.
* Giữ nguyên các thay đổi sẵn có không liên quan trong working tree.
