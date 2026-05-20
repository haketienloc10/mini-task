# [PLANNER_BRIEF_DOCUMENT]

> **INSTRUCTIONS FOR LLM**: Tuân thủ nghiêm ngặt định dạng bên dưới. Thay thế các nội dung trong ngoặc vuông `[...]` bằng dữ liệu tương ứng. Không tự ý thêm các phần mới. Nếu một trường không có dữ liệu hoặc không áp dụng, hãy điền `None` hoặc `N/A`.

## 1. META_CLASSIFICATION
- **Classification**: NORMAL_RUN
- **Related_Epic**: None
- **Why_Bounded**: Yêu cầu chỉ tập trung vào việc tái cấu trúc giao diện người dùng (UI/UX) ở phía frontend bằng cách sửa đổi stylesheet CSS và cấu trúc HTML tĩnh. Các phần logic xử lý API backend trong `src/` và logic tương tác DOM cốt lõi trong `public/app.js` sẽ được giữ nguyên, đảm bảo phạm vi thay đổi an toàn và cô lập.
- **Independent_Verification_Target**: N/A

## 2. OBJECTIVES_AND_CONTEXT
### 2.1. Goal
> Thiết kế lại giao diện người dùng (UI/UX) của ứng dụng Codex Task Dispatch theo phong cách Glassmorphism hiện đại, hỗ trợ chuyển đổi Light/Dark Mode (mặc định là Dark Mode), tối ưu hóa responsive và micro-animations mà không làm ảnh hưởng đến các chức năng hoạt động hiện tại.

### 2.2. Context_Summary
> Giao diện hiện tại của Codex Task Dispatch khá đơn giản và chưa tối ưu về mặt trải nghiệm thị giác. Việc nâng cấp giao diện bằng Glassmorphism, bảng màu HSL hiện đại, và micro-animations sẽ giúp giao diện trực quan và chuyên nghiệp hơn, tạo cảm hứng làm việc cho nhà phát triển. Đồng thời, do ứng dụng dựa trên các selector DOM cố định để giao tiếp với backend, việc lập kế hoạch kỹ lưỡng là cần thiết để tránh làm đứt gãy kết nối JavaScript.

## 3. SCOPE_BOUNDARIES
### 3.1. In_Scope
- Nâng cấp tệp stylesheet `public/styles.css` bằng cách sử dụng biến CSS HSL, font chữ Google Fonts (Inter, Outfit), hiệu ứng Glassmorphism (backdrop-filter, mờ nền, viền bán trong suốt, shadow mịn) và micro-animations cho hover/active.
- Cấu trúc lại giao diện trong `public/index.html` để cải thiện layout responsive (trên thiết bị di động, tablet, desktop) và thêm các thẻ meta tối ưu SEO (title, description, keywords, Open Graph).
- Hỗ trợ chế độ Dark Mode và Light Mode (mặc định là Dark Mode), cho phép người dùng chuyển đổi theme và lưu lựa chọn của họ vào `localStorage` bằng một script độc lập, không xâm lấn.
- Giữ nguyên tất cả các ID và Class mà `public/app.js` đang sử dụng để thao tác dữ liệu và gắn sự kiện DOM.

### 3.2. Out_Of_Scope
- Thay đổi logic JavaScript xử lý API và quản lý trạng thái trong `public/app.js` (ngoại trừ việc bổ sung an toàn một script nhỏ riêng biệt phục vụ cho tính năng chuyển theme).
- Thay đổi mã nguồn backend bao gồm `src/server.mjs`, `src/taskStore.mjs` hoặc `src/runner.mjs`.
- Tích hợp các framework UI hoặc thư viện CSS bên thứ ba quá cồng kềnh (như Tailwind CSS, Bootstrap, v.v.).

## 4. ACCEPTANCE_CRITERIA (AC)
> RÀNG BUỘC: Viết AC dưới góc độ hành vi của hệ thống hoặc người dùng (Behavior-driven).
- [ ] AC1: Khi người dùng truy cập ứng dụng, giao diện hiển thị mặc định ở chế độ Dark Mode với thiết kế Glassmorphism chuyên nghiệp (hiệu ứng mờ nền mịn, viền mỏng trong suốt và bóng đổ nhẹ trên các panel).
- [ ] AC2: Khi người dùng nhấp vào nút toggle theme, giao diện chuyển đổi mượt mà giữa chế độ tối (Dark Mode) và sáng (Light Mode), đồng thời ghi nhớ trạng thái này qua các phiên tải lại trang.
- [ ] AC3: Khi người dùng tương tác hover/click vào các nút bấm (Refresh, Create, Run) hoặc danh sách Task, hệ thống phản hồi bằng các hiệu ứng chuyển động nhỏ (micro-animations) mượt mà.
- [ ] AC4: Khi thay đổi kích thước màn hình hiển thị (từ di động 320px đến máy tính để bàn lớn 1440px+), layout tự động co giãn và sắp xếp lại các panel một cách trực quan, không xảy ra lỗi vỡ khung hình hay tràn văn bản.
- [ ] AC5: Toàn bộ chức năng hiện tại của ứng dụng (bao gồm tạo task, chọn task, hiển thị thông tin chi tiết, log, lỗi và chạy task) phải hoạt động hoàn toàn bình thường mà không phát sinh lỗi JavaScript ở Console.
- [ ] AC6: Mã nguồn HTML chứa đầy đủ các thẻ meta mô tả, từ khóa, Open Graph phục vụ cho việc hiển thị SEO chuẩn.

## 5. IMPACT_AND_RISK_ASSESSMENT
### 5.1. Likely_Impacted_Areas
- **Module**: Các tệp tĩnh phía client: `public/index.html` và `public/styles.css`.
- **Page_API**: None
- **Data_Model**: None
- **Test_Area**: Giao diện hiển thị thực tế (Responsive, CSS styling, theme toggle) và toàn bộ tính năng frontend. Cần chạy kiểm thử tự động của hệ thống (`tests/`) để đảm bảo không ảnh hưởng tới API.

### 5.2. Risks_And_Unknowns
- Việc thay đổi cấu trúc HTML hoặc vô tình chỉnh sửa tên các ID/Class chính có thể làm hỏng logic binding trong `public/app.js`. Biện pháp khắc phục là lập danh sách chi tiết các selector không được thay đổi cho Generator.
- Một số trình duyệt cũ hoặc cấu hình máy yếu có thể gặp hiệu năng kém với `backdrop-filter: blur`, cần cấu hình màu nền fallback hợp lý khi không hỗ trợ CSS này.

## 6. HANDOFF_NOTES
### Planner_Notes_For_Generator
- **Danh sách các Selector bắt buộc bảo toàn**: Cấm đổi tên hoặc xóa các selector sau trong HTML: `#taskForm`, `#taskList`, `#taskDetail`, `#taskCount`, `#formMessage`, `#runButton`, `#refreshButton`, thẻ `<select name="subagent">`, class `.task-item`, thuộc tính `data-task-id`, class trạng thái `.status`, `.Running`, `.Done`, `.Failed`, các class `.detail-content`, `.detail-grid`, `.empty`, và các thẻ `<pre>` hiển thị Log, Output, Error.
- **Quản lý theme an toàn**: Nên triển khai theme thông qua việc thay đổi class (ví dụ `.dark-theme` / `.light-theme` hoặc `data-theme="dark/light"`) ở thẻ `<html>` hoặc `<body>`. Có thể chèn một khối `<script>` nhỏ ở cuối `index.html` hoặc import một script phụ để xử lý việc ghi và đọc trạng thái theme từ `localStorage` khi nhấn nút chuyển đổi.
- **Khai báo Font và CSS Variables**: Hãy import font 'Inter' và 'Outfit' từ Google Fonts ở đầu file HTML. Sử dụng CSS variables với định dạng HSL ở `:root` để dễ dàng chuyển đổi màu sắc toàn bộ giao diện và chỉnh sửa độ trong suốt cho Glassmorphism.
- **Kiểm thử**: Chạy `npm test` định kỳ để đảm bảo cấu trúc HTML sửa đổi vẫn đáp ứng đúng các mong đợi về API của hệ thống.