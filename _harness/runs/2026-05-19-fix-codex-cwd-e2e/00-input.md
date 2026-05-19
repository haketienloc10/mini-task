# [RUN_INPUT_PAYLOAD]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Điền thông tin vào các block tương ứng. Phân biệt rõ ràng giữa nguyên bản yêu cầu và bản tóm tắt. Nếu không có ghi chú thêm, điền `None`.

## 1. RUN_METADATA
- **Run_ID**: 2026-05-19-fix-codex-cwd-e2e

## 2. RAW_USER_REQUEST
anh start app và chạy thử 1 task và gặp lỗi sau: Started session c76a96c8-e1d9-4087-824b-47cb5292805d
Process reference 75125
Command codex
stderr:
Debugger attached.
error: unexpected argument '--cwd' found

  tip: to pass '--cwd' as a value, use '-- --cwd'

Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

For more information, try '--help'.
Waiting for the debugger to disconnect... hãy fix lỗi này và thực hiện kiểm thử E2E sau khi fix giúp anh.

## 3. INTENT_BRIEF
Sửa lỗi khi chạy task qua app khiến `codex exec` thất bại vì argument `--cwd` không còn được CLI chấp nhận, rồi kiểm thử E2E sau khi sửa.

## 4. ADDITIONAL_NOTES
* Phát hiện ban đầu: `src/runner.mjs` đang spawn process với `cwd: path.resolve(task.workspacePath)` nhưng đồng thời truyền `args: ['exec', '--full-auto', '--cwd', path.resolve(task.workspacePath), '--prompt-file', promptFile]`.
* Lỗi runtime cho thấy CLI hiện tại không nhận `codex exec --cwd`; cần giữ hành vi chạy trong workspace nhưng không truyền option không hợp lệ.
* Sau khi sửa cần kiểm tra unit/API và một luồng E2E chạy app, tạo/chạy một task, xác nhận không còn lỗi `unexpected argument '--cwd' found`.
