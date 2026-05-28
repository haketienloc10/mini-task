# Intent Snapshot

## Current Intent

- Trong màn hình `Task Management`, chuyển tab `Workspace` sang màn hình `Dự án`.
- Thay đổi thứ tự sidebar để `Dự án` đứng trước `Công việc`.

## Desired Outcome

- Người dùng nhìn thấy `Dự án` là entry/screen chính thay cho `Workspace` trong ngữ cảnh `Task Management`.
- Sidebar ưu tiên luồng làm việc theo dự án trước, sau đó mới đến danh sách công việc.

## Boundaries to Keep

- Không redesign toàn bộ navigation.
- Không đổi data model, business logic, hoặc workflow quản lý task/project nếu không cần.
- Không mở rộng sang feature mới ngoài đổi nhãn, màn hình đích, và thứ tự hiển thị liên quan.
- Giữ style UI/navigation hiện có của ứng dụng.

## Confirmed Decisions

- `Workspace` không còn là tab chính được hiển thị trong `Task Management`.
- `Dự án` sẽ thay vai trò hiển thị hiện tại của `Workspace`.
- Trong sidebar, `Dự án` đứng trước `Công việc`.

## Current Assumptions

- `Workspace` hiện đang đại diện cho khu vực quản lý/nhóm hóa theo dự án.
- `Công việc` tương ứng với task list hoặc task-focused screen hiện có.
- Đây là thay đổi UI/navigation, không phải thay đổi cấu trúc dữ liệu.

## Evaluation Criteria

- Sidebar hiển thị `Dự án` trước `Công việc`.
- Màn hình/tab trước đây hiển thị là `Workspace` được đổi sang `Dự án`.
- Navigation vẫn hoạt động đúng sau khi đổi thứ tự.
- Không xuất hiện nhãn `Workspace` ở vị trí người dùng kỳ vọng là `Dự án`.

## Open Points

- Cần kiểm tra source để xác định `Workspace` đang là label đơn thuần, route, component, hay entity domain rộng hơn.
- Nếu `Workspace` có nghĩa rộng hơn `Dự án` trong code hiện tại, chỉ nên đổi phần user-facing label/navigation thay vì rename sâu toàn bộ domain.

## Next Thinking Points

- Khi implement, ưu tiên sửa cấu hình/navigation map hoặc component render sidebar nếu có.
- Sau khi sửa, kiểm tra cả desktop/mobile sidebar nếu app có responsive navigation.
- Nên tìm test/snapshot liên quan đến navigation hoặc UI labels để cập nhật tối thiểu.
