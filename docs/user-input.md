# Ý tưởng dự án: Codex Task Dispatch

## Bối cảnh

Tôi thường sử dụng Codex CLI để làm việc với các task lập trình, review, phân tích hoặc chỉnh sửa dự án. Quy trình hiện tại còn khá thủ công: mỗi lần có việc, tôi phải mở terminal, chạy Codex CLI, rồi gửi prompt trực tiếp hoặc chuẩn bị một file chứa nội dung task để Codex xử lý.

Cách làm này vẫn hiệu quả, nhưng khi số lượng task tăng lên, việc quản lý trở nên rời rạc. Tôi khó theo dõi task nào đã tạo, task nào đang chạy, task nào đã hoàn tất, task nào giao cho agent nào, và kết quả của từng lần chạy nằm ở đâu. Ngoài ra, mỗi lần làm việc tôi đều phải tự nhớ cách gọi Codex, tự copy prompt, tự chọn đúng subagent, và tự quản lý session.

Tôi muốn nâng cấp quy trình này thành một ứng dụng web đơn giản, đóng vai trò như một bảng điều phối task cho Codex CLI.

## Mục tiêu tổng quát

Xây dựng một webapp cho phép tôi tạo các task nhỏ, mô tả yêu cầu cần làm, sau đó chọn một subagent cụ thể để xử lý task đó. Khi task được assign cho subagent, hệ thống sẽ tự động mở một session Codex CLI mới và gửi đúng yêu cầu cho subagent đã chọn.

Mỗi task phải tương ứng với một session Codex riêng biệt. Không dùng chung session giữa các task. Điều này giúp giữ nguyên cách Codex CLI đang hoạt động, tránh trộn lẫn context giữa các công việc khác nhau, đồng thời giúp việc theo dõi, debug và review kết quả rõ ràng hơn.

## Vấn đề cần giải quyết

Quy trình hiện tại có một số điểm bất tiện:

1. Tôi phải tự mở Codex CLI mỗi khi muốn làm một task mới.
2. Tôi phải tự copy prompt hoặc tự truyền file prompt vào Codex.
3. Tôi phải tự nhớ task đó nên giao cho subagent nào.
4. Tôi khó quản lý nhiều task đang làm song song hoặc đã hoàn tất.
5. Tôi khó xem lại lịch sử task, log, output và trạng thái xử lý.
6. Tôi không có một giao diện tập trung để quản lý toàn bộ các lần làm việc với Codex.
7. Khi task nhỏ nhiều lên, thao tác thủ công làm mất thời gian và dễ sai.

Dự án này nhằm biến quy trình đó thành một workflow có giao diện rõ ràng hơn: tạo task, chọn agent, chạy task, xem trạng thái, xem kết quả.

## Đối tượng sử dụng chính

Người dùng chính là cá nhân tôi hoặc một developer thường xuyên dùng Codex CLI trong công việc hằng ngày.

Ứng dụng không cần thiết kế cho team lớn ở giai đoạn đầu. MVP chỉ cần phục vụ tốt cho một người dùng local, tập trung vào tốc độ thao tác, sự rõ ràng, và khả năng quản lý task/session.

## Khái niệm chính

### Task

Task là một đơn vị công việc nhỏ mà tôi muốn Codex xử lý.

Một task có thể là:

- Review một phần code.
- Viết hoặc chỉnh sửa một file.
- Lập kế hoạch cho một feature.
- Phân tích lỗi.
- Tạo implementation contract.
- Kiểm tra output của một subagent khác.
- Viết tài liệu.
- Refactor một phần nhỏ của dự án.

Task cần có tối thiểu:

- Tiêu đề.
- Nội dung mô tả yêu cầu.
- Dự án hoặc thư mục làm việc liên quan.
- Subagent được assign.
- Trạng thái xử lý.
- Kết quả hoặc log sau khi chạy.

### Subagent

Subagent là agent chuyên trách đã được định nghĩa sẵn trong môi trường Codex.

Ví dụ:

- Planner: phân tích yêu cầu, tạo plan hoặc contract.
- Generator: thực hiện chỉnh sửa hoặc tạo output.
- Reviewer: review kết quả, phát hiện vấn đề.
- Evaluator: kiểm tra tiêu chí hoàn thành.
- Agent tùy chỉnh khác theo nhu cầu cá nhân.

Ứng dụng không cần tự định nghĩa lại toàn bộ hành vi của subagent. Nó chỉ cần cho phép tôi chọn subagent phù hợp và dispatch task đó đến đúng agent.

### Session

Session là một lần chạy Codex CLI độc lập.

Nguyên tắc quan trọng:

- Mỗi task tạo ra một session Codex mới.
- Không dùng chung session giữa nhiều task.
- Không reuse context của task trước cho task sau.
- Session nào thuộc task nào phải được theo dõi rõ ràng.
- Kết quả của session phải gắn với task tương ứng.

Cách này giúp tránh nhiễu context và giữ đúng tinh thần: mỗi task là một đơn vị xử lý độc lập.

## Workflow mong muốn

### Bước 1: Tạo task

Tôi mở webapp và tạo một task mới.

Khi tạo task, tôi nhập:

- Tên task.
- Mô tả yêu cầu.
- Dự án hoặc workspace liên quan.
- Ghi chú bổ sung nếu có.

Task sau khi tạo sẽ ở trạng thái nháp hoặc đã tạo, nhưng chưa chạy.

### Bước 2: Chọn subagent

Tôi chọn subagent sẽ xử lý task đó.

Ví dụ:

- Nếu task là phân tích yêu cầu, chọn Planner.
- Nếu task là implement, chọn Generator.
- Nếu task là review, chọn Reviewer.
- Nếu task là kiểm tra chất lượng, chọn Evaluator.

Việc chọn subagent phải rõ ràng, dễ thao tác, không cần nhớ tên lệnh hoặc cú pháp CLI.

### Bước 3: Assign và chạy task

Sau khi task đã có nội dung và subagent, tôi bấm assign hoặc run.

Hệ thống sẽ tự động tạo một session Codex CLI mới cho task này.

Task chuyển sang trạng thái đang chạy.

### Bước 4: Theo dõi trạng thái

Trong khi task đang chạy, tôi có thể xem trạng thái xử lý.

Trạng thái tối thiểu gồm:

- Created: task đã được tạo.
- Assigned: task đã được gán agent.
- Running: Codex đang xử lý.
- Done: task hoàn tất thành công.
- Failed: task lỗi.
- Cancelled: task bị hủy nếu sau này có hỗ trợ.

MVP chỉ cần các trạng thái cơ bản, nhưng cách thiết kế ý tưởng nên đủ rõ để mở rộng sau.

### Bước 5: Xem output

Khi session hoàn tất, tôi có thể mở task để xem:

- Kết quả trả về.
- Log xử lý.
- Lỗi nếu có.
- Thời điểm bắt đầu và kết thúc.
- Agent nào đã xử lý.
- Workspace hoặc dự án liên quan.

Kết quả phải gắn với đúng task, không bị trộn với task khác.

## Nguyên tắc thiết kế sản phẩm

### 1. Task là trung tâm

Ứng dụng không nên bắt đầu từ terminal command, mà bắt đầu từ task.

Người dùng nghĩ theo hướng:

“Tôi có một việc cần làm, tôi tạo task, rồi giao cho agent.”

Không phải:

“Tôi phải nhớ câu lệnh nào để gọi Codex.”

### 2. Một task, một session

Đây là nguyên tắc cốt lõi.

Mỗi task phải mở một session Codex riêng. Không chia sẻ session, không gom nhiều task vào một session, không để context của task này ảnh hưởng task khác.

### 3. Subagent được chọn rõ ràng

Người dùng phải biết task này được giao cho agent nào.

Không nên để hệ thống tự đoán agent trong MVP. Giai đoạn đầu nên để người dùng chủ động chọn agent để giữ sự kiểm soát.

### 4. Không thay đổi bản chất Codex CLI

Ứng dụng chỉ là lớp quản lý và điều phối phía trên Codex CLI.

Nó không thay thế Codex CLI, không thay đổi cơ chế session của Codex, không tạo một runtime agent hoàn toàn mới.

Nó chỉ giúp thao tác với Codex CLI thuận tiện hơn.

### 5. Dễ xem lại lịch sử

Mỗi task sau khi chạy xong cần có lịch sử rõ ràng:

- Đã chạy khi nào.
- Giao cho agent nào.
- Nội dung task là gì.
- Kết quả là gì.
- Có lỗi gì không.

Điều này giúp tôi review lại quá trình làm việc và tái sử dụng các task tương tự trong tương lai.

### 6. MVP phải đơn giản

Giai đoạn đầu không cần xây workflow automation phức tạp.

Không cần tự động chuyển từ Planner sang Generator rồi Reviewer.

Không cần team collaboration.

Không cần phân quyền.

Không cần hệ thống queue nâng cao.

Không cần dashboard thống kê phức tạp.

MVP chỉ cần làm thật tốt luồng:

Tạo task → chọn subagent → mở Codex session mới → chạy → xem kết quả.

## Phạm vi MVP

MVP cần tập trung vào các chức năng sau:

### Quản lý task

Người dùng có thể tạo, xem danh sách, mở chi tiết task, và xem trạng thái task.

Task phải có nội dung mô tả rõ ràng và có thể gắn với một workspace hoặc dự án cụ thể.

### Assign task cho subagent

Người dùng có thể chọn một subagent cụ thể cho từng task.

Mỗi task chỉ cần assign cho một subagent trong MVP.

### Chạy task

Người dùng có thể chạy task đã tạo.

Khi chạy, hệ thống phải tạo một session Codex mới, riêng biệt cho task đó.

### Theo dõi trạng thái

Người dùng có thể biết task đang ở trạng thái nào.

Tối thiểu cần phân biệt được task chưa chạy, đang chạy, đã xong, hoặc bị lỗi.

### Xem output

Người dùng có thể xem kết quả xử lý của Codex sau khi task hoàn tất.

Nếu có lỗi, task phải hiển thị được thông tin lỗi ở mức đủ để debug.

## Ngoài phạm vi MVP

Những phần sau chưa cần làm trong MVP:

- Tự động chia task lớn thành nhiều task nhỏ.
- Tự động chọn subagent bằng AI.
- Tự động chạy nhiều subagent nối tiếp nhau.
- Multi-user.
- Phân quyền.
- Remote execution.
- Tích hợp GitHub sâu.
- Tạo pull request tự động.
- Quản lý nhiều máy chạy agent.
- Chat realtime phức tạp với session đang chạy.
- Resume session cũ cho task mới.
- Tối ưu chi phí token.
- Báo cáo thống kê nâng cao.

Các phần này có thể được xem là hướng mở rộng sau khi MVP ổn định.

## Trải nghiệm người dùng mong muốn

Tôi muốn mở webapp và nhìn thấy danh sách task.

Khi có việc mới, tôi bấm tạo task, nhập yêu cầu, chọn project, chọn agent, rồi bấm chạy.

Sau đó tôi có thể rời khỏi terminal, chỉ cần quan sát trên webapp xem task đang chạy hay đã xong.

Khi task hoàn tất, tôi mở task để xem output.

Trải nghiệm lý tưởng là:

- Ít thao tác hơn dùng terminal thủ công.
- Không cần nhớ cú pháp gọi Codex.
- Không cần tự copy prompt nhiều lần.
- Không bị lẫn session.
- Dễ quản lý lịch sử.
- Dễ biết task nào do agent nào xử lý.

## Thành công của MVP được đo bằng gì

MVP được xem là thành công nếu:

1. Tôi có thể tạo task từ webapp.
2. Tôi có thể chọn subagent cho task.
3. Mỗi task khi chạy tạo một session Codex riêng.
4. Tôi có thể xem trạng thái task.
5. Tôi có thể xem output/log sau khi task hoàn tất.
6. Quy trình này nhanh và tiện hơn so với việc tự mở terminal, chạy Codex CLI, rồi copy prompt thủ công.
7. Không có hiện tượng nhiều task dùng chung context hoặc chung session ngoài ý muốn.

## Tầm nhìn mở rộng sau MVP

Sau khi MVP ổn định, dự án có thể mở rộng thành một hệ thống điều phối agent workflow mạnh hơn.

Một số hướng mở rộng:

- Cho phép task đi qua nhiều bước: Planner → Generator → Reviewer → Evaluator.
- Cho phép tạo workflow template.
- Cho phép mỗi subagent ghi artifact riêng.
- Cho phép review output trước khi chuyển sang agent tiếp theo.
- Cho phép tạo task con từ task lớn.
- Cho phép tích hợp với repository, issue, pull request.
- Cho phép theo dõi chi phí, token, thời gian chạy.
- Cho phép dashboard thống kê hiệu suất agent.
- Cho phép lưu lại prompt/task hay dùng làm template.
- Cho phép quản lý nhiều workspace hoặc nhiều project.

Tuy nhiên, các hướng mở rộng này không nên làm phức tạp MVP. Giai đoạn đầu chỉ cần tập trung vào một workflow thật rõ:

Tạo task, chọn agent, chạy Codex session riêng, xem kết quả.

## Tóm tắt ngắn

Dự án là một webapp điều phối task cho Codex CLI.

Thay vì mỗi lần làm việc phải mở terminal, chạy Codex và tự gửi prompt, tôi muốn có một giao diện web để tạo task, chọn subagent, và để hệ thống tự mở một session Codex mới cho task đó.

Nguyên tắc quan trọng nhất là mỗi task tương ứng với một session Codex độc lập. MVP chỉ cần hỗ trợ tạo task, assign cho một subagent, chạy Codex session mới, theo dõi trạng thái và xem output.