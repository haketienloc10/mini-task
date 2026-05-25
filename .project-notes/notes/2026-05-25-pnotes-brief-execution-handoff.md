---
id: 2026-05-25-pnotes-brief-execution-handoff
type: continuity
task: pnotes-brief-execution-handoff
created_at: 2026-05-25
signal: 'Implement pnotes brief: Change Safety Brief aggregated từ top-3 notes theo area/tag/task'
handoff: pnotes-brief-execution-handoff.md
areas:
- pnotes-cli/src
tags:
- feature
decisions:
- build_brief() trả String thay vì print trực tiếp — để unit test được mà không cần capture stdout
- sections dùng fn pointer array thay vì lặp 5 lần — đủ đơn giản, không cần macro
- collect_superseded_ids() tách riêng thành helper — testable độc lập và reusable
invariants:
- supersede filter áp dụng TOÀN BỘ note (không per-field) trước khi scoring
- section rỗng phải in (none) — không skip, không bỏ trống
- notes cũ không có 5 fields mới vẫn phải parse thành công (serde default)
risks:
- filter_summary dùng areas.clone() trước khi move vào RecallFilter — phải clone đúng thứ tự
- 'fn pointer lifetime: fn(&NoteFrontmatter) -> &Vec<String> — HRTB, compile ok nhưng dễ bị nhầm với closure capture'
---

## task
pnotes-brief-execution-handoff — 2026-05-25

## deviations
- Spec nói "5. Nếu không có filter: sort by recency" nhưng cmd_recall cũng dùng score=0 cho no-filter rồi sort by date — giữ nhất quán, không thêm recency boost vào brief (brief không cần boost vì chỉ lấy top 3, không ảnh hưởng kết quả)

## traps
- `areas.clone()` phải xảy ra TRƯỚC khi `areas` bị move vào `RecallFilter` — nếu đổi thứ tự sẽ compile error "use of moved value"
- `fn(&NoteFrontmatter) -> &Vec<String>` trong array literal: Rust cần closures không capture gì mới coerce được sang fn pointer — OK với `|fm| &fm.decisions` nhưng sẽ fail nếu closure capture biến ngoài

## dead_ends
- Thử dùng `writeln!(out, ...)` với `std::fmt::Write` — bị conflict tên với `std::io::Write`, cần alias; chuyển sang `push_str(&format!(...))` đơn giản hơn

## validation_delta
- 13/13 tests pass (8 cũ + 5 mới)
- Smoke test pnotes brief --area src/session-manager: output đúng format spec
- Smoke test empty brief: in đúng hint message
- Binary rebuilt và copy vào bin/pnotes

## next_agent_hint
- Phase-2 items: update pnotes guide, thêm --file filter, files: frontmatter field, expected_validation.must_run
- Nếu cần add tests: và missing_tests fields chưa có test coverage cho populate từ CLI (chỉ tests từ frontmatter parse) — cần integration test hoặc refactor cmd_add_continuity để nhận dir param
