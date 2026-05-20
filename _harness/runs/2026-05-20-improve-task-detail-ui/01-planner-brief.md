# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Yêu cầu chỉ liên quan đến việc điều chỉnh CSS và quản lý class động của tab Task Detail ở phía client để căn lề trái (không căn giữa) các trường thông tin hiển thị bao gồm Log, Description và Output. Thay đổi này hoàn toàn cô lập ở frontend (file `public/styles.css` và `public/app.js`), không làm thay đổi API backend hay cấu trúc dữ liệu.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Loại bỏ căn giữa và định dạng chữ in nghiêng không mong muốn cho các phần nội dung của tab Task detail (bao gồm Log, Description, Output) trên giao diện web, căn lề trái chúng một cách chuyên nghiệp và dễ theo dõi hơn.

### 2.2. Context_Summary
> Hiện tại, container `#taskDetail` được gắn sẵn class `empty` từ tệp HTML tĩnh ban đầu. Khi người dùng chọn một task để xem chi tiết, logic trong JavaScript (`public/app.js`) cập nhật nội dung bên trong của `#taskDetail` nhưng không gỡ bỏ class `empty` của container này. Do đó, toàn bộ phần thông tin chi tiết (Description, Log, Output) bị kế thừa các thuộc tính CSS của `.empty` (`text-align: center` và `font-style: italic`), làm cho việc hiển thị log dài và code trở nên rất lộn xộn và khó đọc. Cần cập nhật logic động để thêm/xóa class `empty` và đảm bảo căn lề trái hiển thị chuẩn.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Cập nhật hàm `renderDetail()` trong `public/app.js` để tự động thêm class `empty` vào `taskDetail` khi không có task nào được chọn, và gỡ bỏ class `empty` này khi có task được chọn hiển thị.
- Cập nhật các định nghĩa CSS trong `public/styles.css` cho `.detail-content p` và `pre` để thiết lập hiển thị căn lề trái (`text-align: left`) một cách tường minh và chuyên nghiệp.
- Cập nhật font chữ monospaced của thẻ `pre` hiển thị logs/output sang font chữ hiện đại hơn (như font monospace hệ thống chuẩn hoặc `Consolas`, `Menlo`, `SFMono`).

### 3.2. Out_Of_Scope
- Thay đổi bất kỳ API backend nào trong thư mục `src/`.
- Thay đổi cấu trúc dữ liệu Task hoặc logic điều phối/chạy task.

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi không có task nào được chọn (hoặc khi bắt đầu tải trang chưa chọn task), tab Task detail hiển thị dòng chữ "Select a task." được căn giữa và in nghiêng.
- [ ] AC2: Khi người dùng nhấp chọn một task từ danh sách, toàn bộ nội dung chi tiết của task (tiêu đề, metadata grid, description, output, log) hiển thị đầy đủ và không bị in nghiêng.
- [ ] AC3: Nội dung văn bản của Description, Output và Log trong Task detail hiển thị căn lề trái (`text-align: left`), giúp lập trình viên dễ dàng theo dõi từ trên xuống dưới.
- [ ] AC4: Font chữ trong khối code/log (Output/Log/Error) sử dụng các font monospace hiện đại, hiển thị đều và thẳng hàng.
- [ ] AC5: Toàn bộ chức năng tạo task, chạy task và toggle theme hoạt động bình thường, không phát sinh lỗi JavaScript ở Console.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: `public/app.js` và `public/styles.css`.
- **Page_API**: None
- **Data_Model**: None
- **Test_Area**: Giao diện hiển thị thực tế của Task detail trên các độ phân giải khác nhau, các test case tự động hiện tại trong `tests/` để đảm bảo API backend hoạt động tốt.

### 5.2. Risks_And_Unknowns
- Việc thay đổi class động của `#taskDetail` có thể làm ảnh hưởng đến các selector CSS khác nếu viết không chuẩn xác. Biện pháp khắc phục là kiểm tra kỹ layout bằng giao diện trực quan sau khi chỉnh sửa.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- **Quản lý class `empty`**: Trong `public/app.js` -> `renderDetail()`, sử dụng `taskDetail.classList.add('empty')` khi `!task` và `taskDetail.classList.remove('empty')` khi render thông tin task.
- **Thiết lập CSS tường minh**: Bổ sung `text-align: left` cho `pre` và `.detail-content p` trong `public/styles.css` để tránh bất kỳ ảnh hưởng kế thừa nào khác từ các style cha.
- **Font monospace chuyên nghiệp**: Thay đổi `font-family` của `pre` sang: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`.
- **Kiểm thử**: Chạy `npm test` để xác minh mọi thứ vẫn hoàn toàn xanh và không có regression lỗi nào xảy ra.