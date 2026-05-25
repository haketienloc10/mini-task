# Agent Run Triage v1 - Party Mode Meeting Record

## 1. Mở phiên

**Secretary**:

Hôm nay team thảo luận hướng sản phẩm cho `mini-task` như một **Agent Work Cockpit**: task board gắn với Codex/agent session/run, dùng để scan trạng thái vận hành và điều phối chi tiết từng task/session/run, không phải Kanban hay todo app tổng quát.

Context đã rõ:

- Board phục vụ scan nhanh các việc: `running`, `needs input`, `failed`, `retryable`, `done/verified`.
- Task detail là cockpit điều phối chính, gồm task status, session identity, agent/subagent, run state, terminal events, messages, artifact path, token usage, error.
- Evidence là phần quan trọng để biết trạng thái có cơ sở, không chỉ là nhãn UI.

Ràng buộc / non-goals:

- Không làm Trello clone.
- Không ưu tiên drag-and-drop Kanban.
- Không trộn `task workflow status` với `runner/session state`.
- Terminal log là operational evidence, không phải output cuối.
- Phiên này không implement; chỉ review hướng sản phẩm và đề xuất scope hẹp tiếp theo.

Project context hiện có:

- Backend: `src/server.mjs`, `src/runner.mjs`, `src/taskStore.mjs`
- Frontend: `public/app.js`, `public/index.html`, `public/styles.css`
- Board hiện có statuses `Assigned / Running / Done / Failed`
- Task detail đã có tabs, chat input, terminal SSE, `sessionRef`, `runArtifactPath`, `tokenUsage`, `messages`, `terminalEvents`

Quyết định cần đạt:

- Triage states nào nên làm trước.
- Actions đầu tiên nên có.
- Evidence nên tự động, thủ công, hay kết hợp.
- Có cần tách rõ `taskStatus` và `runStatus` trước khi mở rộng UI lớn không.

Role tham gia:

- Business Analyst / BA
- Customer Advocate
- Product Owner / Scope Owner
- Technical Lead
- QA / Quality Analyst
- UX / Workflow Designer
- Secretary / Meeting Scribe

## 2. Vòng 1 - Quan điểm ban đầu

**BA**:

Tôi nhìn yêu cầu này như một vấn đề clarity trước khi là vấn đề UI. Hướng Agent Work Cockpit là đúng, nhưng requirement chính là không được dùng một `status` duy nhất để đại diện cả lifecycle của task, trạng thái runner/session, retryability, error và verification.

Điểm tôi cần bảo vệ là:

- `taskStatus` phải mô tả trạng thái nghiệp vụ của task.
- `runStatus` phải mô tả trạng thái vận hành của agent/session/run.
- Board không cần DnD ở giai đoạn này; cần scanability và evidence hơn.
- Terminal log là operational evidence, không phải final output.
- `Done` chưa đủ nếu không phân biệt với `Verified`.

Tôi chưa yên tâm ở các điểm:

- Chưa rõ triage states MVP gồm những gì.
- Chưa rõ action đầu tiên là resume, send input, retry, mark verified hay open artifact.
- Chưa rõ một task có nhiều runs hay chỉ một active run.
- Chưa rõ evidence tự động và evidence thủ công có precedence thế nào.

Tôi đồng ý đi tiếp nếu scope hẹp tiếp theo chốt được model clarity trước UI lớn: tách `taskStatus` / `runStatus`, có business rules, có acceptance conditions, và có rule rõ khi nào `done` thành `verified`.

**Customer Advocate**:

Với góc nhìn user, hướng Agent Work Cockpit đúng pain point hơn Kanban/todo. User không cần kéo thẻ qua cột; user cần mở board và biết trong vài giây:

- Việc nào đang chạy thật.
- Việc nào đang chờ mình trả lời.
- Việc nào fail nhưng retry được.
- Việc nào đã hoàn tất và có evidence đủ tin.
- Bước tiếp theo là gì.

Tôi lo rằng nếu board vẫn chỉ là `Assigned / Running / Done / Failed`, user vẫn phải mở từng task rồi đọc log để tự suy luận. `Failed` chung chung không nói được nên retry, đọc log, hay bỏ qua.

Tôi muốn outcome phải có next action rõ. Action đầu tiên nên ưu tiên:

1. `Provide input` cho `needs_input`
2. `Retry run` cho failed/retryable
3. `Mark verified` hoặc `Confirm done` cho done có evidence
4. `Open artifact`
5. `View evidence`

Tôi đồng ý nếu slice đầu giúp user tin được trạng thái và biết hành động tiếp theo, không chỉ làm board giống Trello hơn.

**Product Owner**:

Tôi đồng ý hướng Agent Work Cockpit. Với MVP, tôi chỉ chấp nhận scope phục vụ triage vận hành: running, needs input, failed, retryable, done/verified. Không mở sang project management tổng quát.

Điểm tôi bảo vệ:

- Không làm Trello clone.
- Không ưu tiên DnD Kanban.
- Board là lớp scan/queue, không phải nơi điều phối chính.
- Detail mới là cockpit.
- Done phải đáng tin hơn nhờ evidence.

Scope hẹp tôi đề xuất là **Agent Run Triage Layer**:

- Chuẩn hóa/tách `taskStatus` và `runStatus`.
- Board hiển thị derived badges: `Running`, `Needs input`, `Failed`, `Retryable`, `Done`, `Verified`.
- Detail có action tối thiểu theo trạng thái.
- Evidence tối thiểu dùng dữ liệu đã có: latest terminal event, latest message, artifact path, token usage, error.

Tôi chưa muốn thêm labels, due dates, DnD, custom columns, bulk actions, workflow builder hoặc verification model phức tạp.

**Technical Lead**:

Về kỹ thuật, hướng này khả thi nếu tách model trước khi mở UI lớn. Rủi ro lớn nhất là state coupling: một field `status` gánh cả task workflow, agent session, run execution, error/retry state và verification.

Tôi muốn:

- `taskStatus` là lifecycle của task.
- `runStatus` là trạng thái execution/session.
- Board hiển thị trạng thái vận hành để scan.
- Task detail chứa session identity, agent/subagent, run state, terminal evidence, messages, artifact path, token usage, error.

Tôi chưa yên tâm nếu `Failed` và `Retryable` bị biến thành cùng một loại workflow status. Retryability nên là thuộc tính/diagnosis của run failure, không nhất thiết là task lifecycle state.

Tôi đồng ý nếu:

- Store/API formalize `taskStatus` và `runStatus`.
- `retryable` hoặc `canRetry` được tính ở một chỗ.
- Terminal log chỉ là evidence, không là source of truth cho final output.
- `Done` và `Verified` không bị đồng nhất.

**QA**:

Tôi ủng hộ hướng này nếu nó test được. Tôi chỉ có thể nghiệm thu khi có state model tối thiểu và transition rules rõ.

Điểm tôi bảo vệ:

- Board scan được `running`, `needs_input`, `failed`, `retryable`, `done`, `verified`.
- Detail cockpit hiển thị được `sessionRef`, agent/subagent, run state, terminal events, messages, artifact path, token usage, error.
- `terminalEvents` là operational evidence, không phải final output.
- `Done` và `Verified` phải tách nhau.

Tôi chưa yên tâm ở các câu hỏi:

- `Running` là task đang làm hay run đang chạy?
- `Failed` là task failed, run failed, hay verification failed?
- `Needs input` đến từ user, agent, tool, hay terminal prompt?
- `Retryable` dựa trên rule nào?
- Done có artifact nhưng chưa verification thì gọi là gì?

Evidence tối thiểu để nghiệm thu:

- Fixture hoặc seed data có các case `running`, `needs_input`, `failed`, `retryable`, `done`, `verified`.
- Board và detail diễn giải cùng một task giống nhau.
- Failed/retryable có error rõ và retry condition rõ.
- Done/verified có evidence phân biệt được.

**UX / Workflow Designer**:

UX cần tránh để user hiểu đây là Kanban/todo app. Trọng tâm không phải “task đang ở cột nào”, mà là “agent/run hiện đang cần gì từ tôi, có bằng chứng gì, và bước tiếp theo là gì”.

Tôi bảo vệ việc tách rõ:

- `taskStatus`: trạng thái công việc theo nghĩa sản phẩm.
- `runStatus`: trạng thái thực thi/session.
- Evidence: terminal events, messages, artifact path, token usage, error phải phục vụ quyết định hành động.

Tôi chưa yên tâm nếu terminal tab đứng ngang hàng quá mạnh với outcome. Nếu user phải đọc log để biết task xong hay fail vì sao, cognitive load đang đặt sai chỗ.

UX slice tôi đề xuất:

- Board thêm visual distinction cho `Running`, `Needs input`, `Failed`, `Retryable`, `Done`, `Verified`.
- Task detail thêm cockpit header: task status, run status, sessionRef, agent/subagent, token usage, artifact path, latest error/latest event summary.
- Primary action thay đổi theo state.
- Terminal tab giữ lại, nhưng default view nên là evidence summary trước.

## 3. Ghi chú thư ký sau vòng 1

**Secretary**:

- Đồng thuận sơ bộ: `mini-task` nên đi theo hướng **Agent Work Cockpit**; board chỉ scan trạng thái, task detail là nơi điều phối chính.
- Điều kiện approval nổi bật:
  - BA cần tách `taskStatus` và `runStatus`, có business rules và state matrix.
  - Customer cần thấy rõ next action, đặc biệt `Provide input` và `Retry`.
  - PO muốn scope hẹp là **Agent Run Triage v1**.
  - TL muốn formalize store/API trước UI lớn; `retryable` là derived property.
  - QA cần fixture/test cho các state chính; không gọi `verified` nếu chưa có proof/manual rule.
  - UX cần cockpit header và board badges phản ánh model; evidence gần header/action.
- Câu hỏi còn mở: slice đầu có cần verification model đầy đủ không, evidence nên là field riêng hay chỉ trình bày dữ liệu hiện có.

## 4. Vòng 2 - Phản biện

**Product Owner -> BA / QA / UX / Technical Lead**:

Tôi cắt `verificationStatus` khỏi slice đầu. MVP chỉ cần `taskStatus=done/failed` và một action `Mark verified` nếu thật nhẹ. Verified chưa phải blocker cho triage ban đầu.

Tôi cũng cắt `evidenceSummary` dạng field riêng. Slice đầu chỉ hiển thị evidence thô đã có: latest terminal event, latest message, artifact path, error, token usage. Summary tự động để sau.

Tôi cắt nhiều action. Giữ tối đa vài action đầu như `Retry`, `Continue/Provide input`, `Review/Open artifact`. Những thứ như cancel, reassign, escalate, reopen để sau.

**BA -> Product Owner**:

Tôi đồng ý không thêm full verification model ngay, nhưng cần chốt `verified` là `taskStatus` hay là lớp xác nhận riêng. Nếu `Done` và `Verified` cùng nằm trong workflow thì luồng là `done -> verified`; nếu tách `verificationStatus` thì `taskStatus=done` đi kèm `verificationStatus=pending|passed|failed`.

**BA -> Technical Lead**:

Cần chốt một task có một run hiện tại hay nhiều run history. `runStatus` mô tả latest run, active run hay aggregate của tất cả runs? Nếu retry tạo run mới, rule hiển thị trên board phải rõ.

**BA -> UX**:

Board hiển thị trạng thái nào là primary cần được chốt. User không nên thấy ba badge ngang hàng mà không biết cái nào quyết định hành động tiếp theo.

**Technical Lead -> Product Owner**:

Technical debt lớn nhất là ưu tiên UI/actions trước khi khóa state model. Nếu `status` tiếp tục gánh cả task workflow và runner state, mỗi action sau này sẽ phải check ngữ cảnh bằng if/else rải rác.

**Technical Lead -> QA / UX**:

Tôi không muốn `retryable` là `runStatus`. `failed` là trạng thái run; `retryable` là khả năng suy ra từ lỗi, exit reason, artifact/session còn hợp lệ. Nên là derived property trước: `canRetry = runStatus === "failed" && retryPolicy/errorCode/sessionRef hợp lệ`.

Board có thể hiển thị “Retryable” như badge/filter, nhưng không nên biến nó thành column/status chính.

**QA -> Technical Lead**:

Khó test nhất là ranh giới `taskStatus` vs `runStatus`. Tôi cần state transition table tối thiểu, kèm 5 fixture: `assigned/no run`, `running`, `needs_input`, `failed_retryable`, `done_with_artifact`.

**QA -> Product Owner**:

Slice đầu chưa nên hứa `verified` nếu chưa có verification mechanism. Tôi chỉ nghiệm thu `done_with_evidence` trước: có `runArtifactPath` hoặc final message, token usage, terminal evidence, error nếu có. `verified` có thể là manual flag sau.

**QA -> UX**:

Khó test nhất là user có hiểu “terminal log không phải output cuối” hay không. Detail view cần tách visual rõ giữa `Operational evidence`, `Final artifact/message`, và `Error`. Board chỉ hiển thị summary, không nhồi log.

**Customer Advocate -> Product Owner**:

User sẽ thất vọng nếu slice đầu chỉ “đúng model” nhưng board/detail vẫn không nói họ phải làm gì tiếp. Với họ, cockpit không phải schema viewer. Nếu thấy `needs_input` mà không có chỗ trả lời ngay, hoặc thấy `failed_retryable` mà không có `Retry`, giá trị cảm nhận gần như bằng log dashboard.

**Customer Advocate -> Technical Lead**:

Tách `taskStatus/runStatus` là nền tốt, nhưng nếu chưa expose thành hành động thì user vẫn phải tự suy luận từ terminal/message/error. Technical correctness không đủ; state phải dẫn tới command kế tiếp.

**UX -> Product Owner**:

Nếu slice chỉ tách model mà UI gần như giữ nguyên, user sẽ không thấy “cockpit”, chỉ thấy board cũ có dữ liệu sạch hơn. MVP phải có ít nhất một thay đổi nhìn thấy: board card cho biết `needs input / retryable / awaiting verification`, và detail có primary action theo trạng thái.

**UX -> Technical Lead**:

Tôi đồng ý cần tách `taskStatus` và `runStatus`, nhưng nếu không expose mapping đó ra UI thì đây là refactor nội bộ. Slice kỹ thuật nên đi kèm cockpit header tối thiểu: `task status`, `run state`, `sessionRef`, latest event/error, artifact path.

## 5. Ghi chú thư ký sau phản biện

**Secretary**:

- Bất đồng đã thu hẹp:
  - `retryable` không phải workflow status; là derived property/action affordance.
  - Chưa thêm full `verificationStatus` trong slice đầu.
  - `Done` không đồng nghĩa `Verified`.
  - `evidenceSummary` không là field riêng trong v1; chỉ trình bày evidence hiện có.
- Vẫn còn điểm cần chú ý:
  - UI vẫn phải làm rõ next actions, không chỉ refactor model bên dưới.
  - Cần tránh để terminal log bị hiểu là output cuối hoặc proof hoàn tất.
- Trade-off chính:
  - Làm model/status rõ trước để tránh nhập nhằng, nhưng vẫn phải có giá trị thấy được ngay ở board/detail.
- Cần user quyết định:
  - Chốt scope tiếp theo là **Agent Run Triage v1** trước khi mở rộng sang verification, PM features hoặc DnD workflow.

## 6. Vòng 3 - Hội tụ

**Product Owner**:

Tôi đề xuất chốt hướng hẹp là **Agent Run Triage v1**.

In scope:

- Tách tối thiểu `taskStatus` và `runStatus`.
- Board hiển thị rõ `Running`, `Needs input`, `Failed`, `Retryable`, `Done`.
- Mỗi task trên board có next action visible theo state: `Continue`, `Retry`, hoặc `Review`.
- Task detail hiển thị evidence thô đã có: latest message, latest terminal event, error, artifact path, token usage.
- Không tạo `evidenceSummary`; chỉ gom và trình bày evidence hiện hữu.
- `Done` chưa đồng nghĩa `Verified`; verification chỉ là action/note thủ công nếu rất nhẹ.

Out of scope:

- Full `verificationStatus` model.
- Evidence summary tự động.
- DnD Kanban/custom columns.
- Priority, labels, due dates, SLA.
- Bulk actions.
- Workflow builder hoặc state machine phức tạp.
- Nhiều action phụ như cancel, reassign, escalate, reopen.

**BA**:

Approve with condition.

Tôi đồng ý hướng hội tụ nếu business rules được ghi rõ:

- `taskStatus` chỉ mô tả lifecycle nghiệp vụ của task.
- `runStatus` chỉ mô tả execution/session/run.
- `runStatus=running` có thể set/display task như `running`.
- `runStatus=waiting_input` map tới `needs_input`.
- `runStatus=completed` map tới `done`, không tự set `verified`.
- `runStatus=failed` map tới `failed` nếu không còn active recovery path.
- `verified` chỉ set bởi user action hoặc explicit verification action.
- `retryable` derived từ `runStatus=failed` + đủ context để retry.
- Board badge priority cần rõ để user biết việc nào cần chú ý trước.

**Customer Advocate**:

Approve with condition.

User-value condition:

- Board phải cho user thấy ngay `running`, `needs input`, `failed retryable`, `done` mà không cần mở detail.
- Cockpit header phải trả lời được: task đang ở đâu, run đang làm gì, user cần làm gì tiếp.
- `retryable` là derived property được, miễn UI vẫn hiển thị rõ `Retry`.
- 2 action must-have đầu tiên: `Provide input` cho `needs_input`, `Retry run` cho `failed_retryable`.
- Action thứ ba nên là `Open artifact` hoặc `View evidence`.

Tôi reject nếu slice đầu chỉ tách model/status nhưng không làm user biết hành động tiếp theo.

**Technical Lead**:

Approve with condition.

Hướng này khả thi và đủ hẹp. Tách `taskStatus/runStatus` là quyết định kỹ thuật đúng. `retryable` để derived property giúp tránh phình state model sớm. Chưa thêm `verificationStatus` riêng là chấp nhận được nếu `Verified` không bị đồng nhất với `runStatus=completed`.

Điều kiện kỹ thuật:

- `taskStatus` và `runStatus` phải được formalize ở store/API trước khi chỉnh UI lớn.
- Derived `retryable/canRetry` phải tính ở một chỗ.
- Cockpit header phải hiển thị task status, run status, session identity, agent/subagent, last error hoặc active prompt.
- Board badges chỉ phản ánh operational scan state, không là source of truth.
- Không thêm DnD, custom workflow hoặc verification model phức tạp trong vòng này.

**QA**:

Approve with condition.

Hướng này test được và scope còn đủ hẹp. Tôi đồng ý chưa thêm `verificationStatus` riêng nếu slice đầu không gọi `verified` là trạng thái chính thức, chỉ hiển thị evidence để user tự đánh giá.

Acceptance conditions:

- `taskStatus` và `runStatus` là field tách biệt.
- `retryable` là derived property có rule rõ.
- Board badge hiển thị tối thiểu task status, run status, retryable nếu có.
- Cockpit header có task title/status, session identity, agent/subagent nếu có, run state, token usage, error summary nếu failed.
- Detail tách rõ final artifact/message với terminal events.
- Fixture/manual test có ít nhất 5 case: assigned/no run, running, needs input, failed retryable, done with artifact.
- Không gọi trạng thái `verified` nếu chưa có proof hoặc manual verification rule.

**UX / Workflow Designer**:

Approve with condition.

Tôi đồng ý hướng này đủ hẹp và vẫn chứng minh được cockpit direction, với điều kiện UX không để model mới bị ẩn dưới UI cũ.

UX conditions:

- Board có badge rõ cho `Needs input`, `Running`, `Failed`, `Retryable`, `Done`.
- Cockpit header tách nhãn trực quan: `Task status` riêng, `Run state` riêng.
- `retryable` là derived property được, nhưng UI phải hiện như action affordance `Retry`, không chỉ là text.
- Next actions tối thiểu context-aware: `Provide input / Resume`, `Retry`, `Open artifact`, `Mark verified` nếu có rule.
- Evidence summary phải nằm gần header/action, không bị chôn trong terminal tab.

## 7. Biên bản cuối phiên

### Recommended Direction

Chốt hướng **Agent Run Triage v1**: tập trung tách rõ trạng thái task và trạng thái run/session, hiển thị next action rõ ràng, và dùng evidence hiện có để hỗ trợ triage.

### Agreed Scope

- Tách model `taskStatus` và `runStatus`.
- Định nghĩa business rules/state matrix tối thiểu.
- Formalize store/API trước khi mở rộng UI lớn.
- Tính `canRetry` tại một chỗ.
- Hiển thị rõ các trạng thái triage: `assigned`, `running`, `needs_input`, `failed_retryable`, `done_with_artifact`.
- Board badges và cockpit header phải expose đúng model.
- Next actions tối thiểu: `Provide input`, `Retry`.
- Evidence hiển thị từ dữ liệu hiện có: artifact path, token usage, messages, terminal events, error.

### Out of Scope

- Trello clone.
- DnD Kanban.
- PM/todo features tổng quát.
- Full `verificationStatus`.
- `evidenceSummary` field riêng.
- Gọi `Done` là `Verified` nếu chưa có proof/manual rule.

### Key Decisions

- Board chỉ dùng để scan; task detail là cockpit điều phối.
- `retryable` là derived property/action affordance, không phải workflow status.
- `Done` không đồng nghĩa `Verified`.
- Terminal events là operational evidence để inspect, không phải final output.
- Evidence v1 dùng dữ liệu hiện có, không tạo field tổng hợp mới.

### Acceptance Conditions

- Có state matrix rõ cho `taskStatus` và `runStatus`.
- Có fixture/test cho:
  - `assigned`
  - `running`
  - `needs_input`
  - `failed_retryable`
  - `done_with_artifact`
- `canRetry` được tính nhất quán tại một chỗ.
- Board và task detail hiển thị trạng thái/next action khớp model.
- Không có UI label nào ngụ ý `verified` khi chưa có proof/manual rule.
- Evidence nằm gần header/action trong cockpit detail.

### Risks / Watch Points

- Dễ trộn workflow status với runner/session state.
- Dễ biến board thành Kanban/todo nếu thêm DnD hoặc PM features quá sớm.
- Dễ làm model đúng nhưng UI không giúp user biết phải làm gì tiếp.
- Dễ hiểu nhầm terminal log là kết quả cuối hoặc proof hoàn tất.

### Open Questions

- Manual verification rule sẽ được định nghĩa khi nào.
- Có cần đặt tên cụ thể cho các derived display states trên board không.
- Evidence presentation nên gom trong header hay thành section riêng trong cockpit detail.

### Handoff Notes

Scope hẹp tiếp theo nên bắt đầu bằng model/state contract và test fixtures, sau đó cập nhật board badges, cockpit header và action affordances để phản ánh đúng **Agent Run Triage v1**.
