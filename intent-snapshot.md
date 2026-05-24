# Intent Snapshot

## Ý định hiện tại

- Task detail cần cho phép xem log terminal thật của mỗi lượt chạy task/turn, thay vì chỉ hiển thị message cuối cùng của agent.
- Log terminal phải phản ánh output thực tế từ command đang chạy trong backend, gồm `stdout`, `stderr`, trạng thái chạy, và kết quả kết thúc.
- Khi dùng `grill-me`, nếu ý định đã đủ rõ thì dừng hỏi thêm và tạo snapshot Markdown để ghi lại ý tưởng hiện tại.

## Outcome mong muốn

- User mở task detail và theo dõi được terminal log realtime khi command đang chạy.
- Mỗi lượt chạy có dấu vết rõ ràng: command nào được chạy, output ra sao, thành công hay thất bại.
- Sau khi command kết thúc, log vẫn còn để xem lại.
- Ý tưởng được ghi lại rõ ràng trong file `intent-snapshot.md` khi đã đủ chín ở mức hiện tại.

## Ranh giới nên giữ

- Tập trung vào realtime terminal log trong task detail, chưa mở rộng sang full terminal emulator.
- Chưa cần interactive stdin, cancel process từ UI, hoặc điều khiển shell trực tiếp.
- Không hỏi lại những thông tin có thể tự khám phá từ source code, config, README, hoặc ngữ cảnh hiện có.
- Snapshot là ảnh chụp ý tưởng hiện tại, không phải kế hoạch triển khai chi tiết.

## Quyết định đã xác nhận

- Chọn hướng stream realtime khi command đang chạy.
- Với source hiện tại, hướng phù hợp là stream từ backend `spawn` output sang UI task detail.
- `grill-me` cần có Completion Behavior: khi đủ rõ thì tạo Markdown snapshot thay vì tiếp tục hỏi thêm.

## Giả định hiện tại

- Command execution hiện nằm ở backend Node.js và có thể hook vào `stdout` / `stderr` stream.
- UI task detail có thể mở một kết nối realtime như SSE hoặc WebSocket để nhận log.
- SSE là lựa chọn đủ tốt cho chiều server-to-client ở giai đoạn đầu.
- Log cần được group theo turn/run để tránh lẫn output giữa các lần chạy.

## Tiêu chí đánh giá ý tưởng

- User có thể nhìn thấy output terminal trong khi task còn đang `Running`.
- Output được gắn đúng task và đúng lượt chạy.
- Reload hoặc xem lại sau khi chạy xong vẫn không mất log quan trọng.
- UI không bị thay thế bởi message cuối cùng; message cuối chỉ là kết quả hội thoại, còn terminal log là evidence vận hành.
- Thiết kế đủ đơn giản để triển khai trong repo hiện tại mà không kéo scope sang terminal emulator.

## Điểm còn mở

- Chọn SSE hay WebSocket cho implementation cuối cùng.
- Có cần persist từng chunk log riêng, hay chỉ stream realtime rồi lưu `stdout.log` / `stderr.log` cuối run.
- UI nên đặt terminal log ở tab riêng hay nằm trong timeline từng turn.
- Có cần cơ chế reconnect để client lấy lại chunk bị thiếu khi mất kết nối.

## Điểm nên suy nghĩ tiếp theo

- Thiết kế model `turn/run/terminal event` tối thiểu để không bị kẹt khi sau này muốn hiển thị lịch sử theo từng turn.
- Xác định mức retention/truncation cho log dài.
- Làm rõ sự khác nhau giữa agent message cuối cùng và terminal evidence để UI không trộn hai loại thông tin này.
