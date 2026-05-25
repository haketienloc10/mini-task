# Intent Snapshot — `pnotes brief`

## Current Intent

Thêm command `pnotes brief` vào CLI `pnotes`: thay vì trả list notes liên quan như `recall`,
trả một Change Safety Brief có cấu trúc — tổng hợp từ frontmatter — giúp agent biết điều
quan trọng trước khi sửa code mà không cần scan toàn repo.

## Desired Outcome

Khi agent chạy `pnotes brief --area src/session-manager`, agent nhận được:

1. Decisions đã chốt quanh vùng code đó
2. Invariants không được phá
3. Known risks / gotchas
4. Tests đang bảo vệ behavior nào
5. Missing test coverage (alert gap)
6. Recent continuity notes liên quan (path + signal)

Output ngắn, có cấu trúc, deterministic — không cần LLM tổng hợp.

## Boundaries to Keep

- `pnotes` là note aggregator, không phải code indexer.
  Brief chỉ aggregate những gì có trong frontmatter — không parse source code.
- `behavior_contract` không vào note. Spec sống trong Handoff. Brief link đến handoff, không duplicate.
- `local_ownership` (callers/callees) và `blast_radius` bị cut hoàn toàn — đây là code analysis.
- `required_read_set` bị cut khỏi MVP — stale quá nhanh nếu manual, out of scope nếu generated.
- `safe_change_boundary` bị cut khỏi MVP — phase-2.

## Confirmed Decisions

1. **Filter:** Reuse recall matching (`--area`, `--tag`, `--task`). Không thêm `--symbol` hoặc `--file` vào MVP.
2. **Frontmatter mới:** 5 optional fields — `decisions`, `invariants`, `risks`, `tests`, `missing_tests`.
3. **Supersedes:** Exclude superseded notes khỏi brief aggregation. Nếu note-A bị supersede bởi note-B, note-A's fields không xuất hiện trong brief.
4. **Empty brief:** Không fail hard. Trả output có cấu trúc với message rõ: "No project memory found for this area." Brief rỗng vẫn hữu ích — nó báo agent chưa có context, không phải báo lỗi.
5. **Output size:** Target < 500 tokens, max 1000. Aggregate top 3 matched notes.
6. **Source attribution:** Mỗi decision/invariant/risk hiển thị kèm `(from: <note-id>)` để agent biết origin và có thể `pnotes show` nếu cần đọc sâu.
7. **Capture flags:** `pnotes add continuity` thêm `--decision`, `--invariant`, `--risk` là repeatable flags (giống `--area`, `--tag`) ngay trong MVP. User không cần tự edit frontmatter.

## Current Assumptions

- Agent biết area khi nhận handoff — không cần filter theo symbol.
- Note author điền các optional fields tại thời điểm viết note (execution time), không maintain liên tục.
- Staleness là chấp nhận được miễn là note date hiện rõ trong output. `supersedes` xử lý explicit retirement.
- Conflicts giữa các notes chưa supersede nhau → hiển thị cả hai kèm source, không auto-resolve. Agent quyết định.

## Evaluation Criteria

- Brief output fit trong một context window section (< 500 tokens thường xuyên).
- Agent có thể chạy `pnotes brief` và biết ngay cần đọc file nào, test nào cần chạy, invariant nào cần giữ — mà không cần scan repo.
- Empty brief không gây confusion — message rõ ràng, có guidance tiếp theo.
- Implementation footprint nhỏ: thêm 5 fields vào `NoteFrontmatter`, thêm `Commands::Brief`, reuse recall logic.

## Open Points

- `expected_validation.must_run` — có thể thêm sau 5 core fields land (low risk).
- `--file <path>` filter — phase-2 nếu agent cần drill down từ area xuống file level.
- `files: Vec<String>` frontmatter field — optional companion cho `--file` filter nếu phase-2 cần.
- LLM usage rule (workflow guide) — cần cập nhật `pnotes guide` để reflect `brief` command.

## Next Thinking Points

- Thứ tự implementation: schema trước (5 fields vào `NoteFrontmatter`), sau đó flags mới cho `add continuity`, sau đó `cmd_brief`, sau đó update `guide`.
- `--decision` và `--invariant` là repeatable flags (giống `--area`, `--tag`). `--risk` tương tự.
- Test case cần có: empty brief, brief với superseded note bị exclude, brief với 2 notes không supersede nhau có decisions khác nhau, note được tạo kèm `--decision` và `--invariant` flags.
