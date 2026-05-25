# Intent Snapshot

## Ý định hiện tại

- `mini-task` sẽ phát triển theo hướng **Agent Work Cockpit**: một task board gắn chặt với session/run của Codex/agent, không phải một Kanban hay todo app tổng quát.
- Board dùng để scan nhanh trạng thái công việc; detail surface dùng để điều phối task, session, run history, terminal evidence và follow-up prompt.
- Giá trị chính là giúp user biết việc nào đang chạy, việc nào cần input, việc nào có thể resume/retry, việc nào failed/blocked, và việc nào done có evidence đủ tin cậy.

## Outcome mong muốn

- User mở `mini-task` và thấy được toàn cảnh agent work theo project/task/session.
- Mỗi task có một cockpit rõ ràng gồm task status, session identity, agent/subagent, run state, terminal events, messages, artifact path, token usage và error nếu có.
- User có thể tiếp tục làm việc với task qua follow-up prompt/resume thay vì phải tìm lại CLI session bằng tay.
- UI giúp chuyển log thuần thành tín hiệu điều phối: running, needs input, failed, retryable, done, verified, hoặc missing evidence.

## Ranh giới nên giữ

- Không biến `mini-task` thành Trello clone hay generic project-management tool.
- Không ưu tiên drag-and-drop Kanban trước khi session control và triage state rõ ràng.
- Không trộn lẫn `task workflow status` với `runner/session state`; hai lớp này cần được nhìn tách bạch.
- Không xem terminal log là sản phẩm cuối cùng; terminal log là evidence vận hành để ra quyết định.
- Không mở rộng sang multi-project PM nặng nếu one-task-one-session workflow chưa thật sự ngon.

## Quyết định đã xác nhận

- Chọn **Option 1: Agent Work Cockpit**.
- Hướng sản phẩm tiếp theo nên ưu tiên control actions và triage states hơn là thêm metadata quản lý task tổng quát.
- Board vẫn cần thiết, nhưng chỉ là lớp scan/queue; task detail mới là nơi điều phối chính.
- App nên tiếp tục bám vào product lineage hiện có: `project -> task -> subagent/chat/run/session`.

## Giả định hiện tại

- Source hiện tại đã có nền tảng phù hợp: board status, task detail tabs, chat input, terminal events, SSE, `sessionRef`, `runArtifactPath`, `tokenUsage`, `messages`.
- Thiếu lớn nhất không phải khả năng tạo/run task, mà là control surface để user triage và can thiệp đúng lúc.
- Các trạng thái như `Needs Input`, `Review`, `Blocked`, `Verified` có thể cần xuất hiện như workflow/triage state riêng, không thay thế hoàn toàn status run hiện tại.
- Resume/retry/follow-up nên trở thành thao tác cấp một trong detail surface.

## Tiêu chí đánh giá ý tưởng

- Từ board, user nhìn được task nào đang chạy, task nào cần user input, task nào failed, task nào có thể resume/retry.
- Từ task detail, user thấy được session/run context mà không cần mở log thuần trước.
- Mỗi action quan trọng với agent work có context rõ: prompt nào đã gửi, command nào đã chạy, session nào được resume, run nào tạo artifact nào.
- Done state đáng tin hơn vì có evidence: terminal result, final agent message, artifact path, token usage, và verification signal nếu có.
- UI phục vụ workflow làm việc lặp lại với Codex/agent, không chỉ là dashboard trang trí.

## Điểm còn mở

- Nên thêm triage states nào trước: `Needs Input`, `Review`, `Blocked`, `Verified`, hay `Retryable`.
- Control actions đầu tiên nên là `Resume`, `Retry`, `Mark Needs Input`, `Mark Reviewed`, hay `Archive`.
- Evidence layer nên tự động suy luận từ terminal/Codex JSON đến mức nào, và phần nào để user đánh dấu thủ công.
- Có cần tách schema thành `taskStatus` và `runStatus` trước khi đổi UI lớn không.

## Điểm nên suy nghĩ tiếp theo

- Vẽ lại task detail quanh một câu hỏi duy nhất: "tôi cần làm gì tiếp với task này?"
- Xác định state model tối thiểu để không bị kẹt khi thêm `Needs Input` và `Review`.
- Chọn một slice nhỏ để validate Agent Work Cockpit: ví dụ `Needs Input + Resume/Retry controls + evidence summary` cho task detail.
