# Execution Handoff — `pnotes brief`

## 1. Objective

Thêm command `pnotes brief` vào CLI `pnotes` (Rust): aggregate từ frontmatter của top-3 matching
notes để trả "Change Safety Brief" có cấu trúc — giúp agent biết decisions, invariants, risks,
tests, missing_tests cần chú ý trước khi sửa code trong một area.

## 2. Final Decision

**Plain-text structured output** với section headers cố định. Reuse recall scoring logic
(`--area`, `--tag`, `--task`). 5 optional frontmatter fields mới. Superseded notes bị loại
toàn bộ khỏi brief. Capture flags (`--decision`, `--invariant`, `--risk`) vào `add continuity`
ngay trong MVP.

## 3. Original Request Alignment

- **Giống intent gốc:** Toàn bộ 7 confirmed decisions giữ nguyên.
- **Làm rõ thêm:** Output format được lock thành plain text + section headers (intent snapshot
  không spec format cụ thể).
- **Defer sang Phase-2:** `pnotes guide` update, `--file` filter, `files:` frontmatter field,
  `expected_validation.must_run`.

## 4. Implementation Scope

**In Scope:**
- 5 optional Vec<String> fields vào `NoteFrontmatter`: `decisions`, `invariants`, `risks`,
  `tests`, `missing_tests`
- `Commands::Brief { area: Vec<String>, tag: Vec<String>, task: Option<String> }` — clap derive,
  reuse filter args giống `Commands::Recall`
- `cmd_brief()` function: load notes → apply supersede filter → score top 3 → aggregate → print
- Supersede filter: collect tất cả IDs bị supersede từ toàn bộ notes trước khi scoring
- 3 repeatable flags mới cho `NoteType::Continuity`: `--decision`, `--invariant`, `--risk`
  (Vec<String>, lưu vào `decisions`/`invariants`/`risks` trong NoteFrontmatter)
- Unit tests cho các edge cases (xem Section 8)

**Out of Scope:**
- `pnotes guide` update
- `--file` filter, `files:` frontmatter field
- `expected_validation.must_run`
- Deduplication across notes
- Hard token truncation / token counting
- LLM inference hoặc code indexing

## 5. Target Files / Areas To Inspect Or Modify

| Area / File Path | Expected Work |
|---|---|
| `pnotes-cli/src/main.rs` — `NoteFrontmatter` struct | Thêm 5 fields: `decisions`, `invariants`, `risks`, `tests`, `missing_tests` (Vec<String>, serde default+skip_if_empty) |
| `pnotes-cli/src/main.rs` — `NoteType::Continuity` | Thêm `--decision`, `--invariant`, `--risk` (Vec<String>) vào clap args |
| `pnotes-cli/src/main.rs` — `cmd_add_continuity()` | Accept và populate 3 fields mới vào NoteFrontmatter |
| `pnotes-cli/src/main.rs` — `Commands` enum | Thêm `Brief` variant với `area`, `tag`, `task` args (giống `Recall`) |
| `pnotes-cli/src/main.rs` — new `cmd_brief()` | Implement full function |
| `pnotes-cli/src/main.rs` — `main()` match arm | Route `Commands::Brief` → `cmd_brief()` |
| `pnotes-cli/src/main.rs` — `mod tests` | Thêm unit tests cho brief logic |

## 6. Technical Contracts

### Data / State Contract

**NoteFrontmatter** — thêm 5 fields, tất cả optional với serde default:

```rust
#[serde(default, skip_serializing_if = "Vec::is_empty")]
decisions: Vec<String>,

#[serde(default, skip_serializing_if = "Vec::is_empty")]
invariants: Vec<String>,

#[serde(default, skip_serializing_if = "Vec::is_empty")]
risks: Vec<String>,

#[serde(default, skip_serializing_if = "Vec::is_empty")]
tests: Vec<String>,

#[serde(default, skip_serializing_if = "Vec::is_empty")]
missing_tests: Vec<String>,
```

**Backward compat:** Notes cũ không có 5 fields này phải parse thành công — `#[serde(default)]`
đảm bảo empty vec. `parse_frontmatter()` không thay đổi.

**Supersede filter contract:**
1. Load all notes (full list)
2. Collect `superseded_ids: HashSet<String>` = union of tất cả `note.supersedes` fields
3. Exclude notes có `id ∈ superseded_ids` TRƯỚC KHI scoring
4. Áp dụng toàn bộ note (không per-field)

### Action / Guard Contract

**NoteType::Continuity** — thêm 3 flags mới:

```rust
#[arg(long)]
decision: Vec<String>,   // --decision "text" (repeatable)

#[arg(long)]
invariant: Vec<String>,  // --invariant "text" (repeatable)

#[arg(long)]
risk: Vec<String>,       // --risk "text" (repeatable)
```

Populate vào `NoteFrontmatter.decisions`, `.invariants`, `.risks` khi tạo note.

**cmd_brief() logic:**

```
1. load_all_notes() → Vec<(PathBuf, NoteFrontmatter)>
2. Build superseded_ids từ toàn bộ notes
3. Filter: giữ notes có id ∉ superseded_ids
4. Score với RecallFilter (giống recall)
5. Nếu không có filter: sort by recency
6. Filter score > 0 (nếu có filter), take top 3
7. Nếu rỗng: print "No project memory found for this area." + next-step hint, return
8. Aggregate: với mỗi section (decisions/invariants/risks/tests/missing_tests):
   - Collect items từ top-3 notes, kèm "(from: <note-id>, <created_at>)"
9. Print plain text output (format bên dưới)
```

### UI / UX Contract

**Output format — normal brief:**

```
=== Change Safety Brief ===
area: src/session-manager  (hoặc filters đã dùng)
notes: 2 matched

DECISIONS
- Decision text here (from: 2026-05-25-session-fix, 2026-05-25)
- Another decision (from: 2026-05-24-auth-work, 2026-05-24)

INVARIANTS
- Invariant text (from: 2026-05-25-session-fix, 2026-05-25)

RISKS
(none)

TESTS
- test_session_create (from: 2026-05-25-session-fix, 2026-05-25)

MISSING TESTS
- Error path not covered (from: 2026-05-24-auth-work, 2026-05-24)
```

**Output format — empty brief (0 matched notes):**

```
=== Change Safety Brief ===
area: src/session-manager

No project memory found for this area.
Run 'pnotes recall --area src/session-manager' to explore related notes,
or 'pnotes add continuity --task <slug> --signal "..." --area src/session-manager'
to start capturing context.
```

**Section với no items:** In `(none)` — không bỏ trống, không skip section.

**Empty section (note có match nhưng fields rỗng):** Section vẫn hiển thị với `(none)`.

### API / Backend Contract

- `load_all_notes()` không thay đổi signature/behavior.
- `score_note()` không thay đổi.
- `RecallFilter` struct không thay đổi.
- `cmd_recall()` không thay đổi.
- Không thêm dependency mới — không cần serde_json hay tokenizer.

## 7. Execution Plan For Future Executor

1. **Inspect** `NoteFrontmatter` struct và thêm 5 fields mới với serde annotations đúng.
2. **Inspect** `NoteType::Continuity` và thêm `--decision`, `--invariant`, `--risk` flags; update `cmd_add_continuity()` để populate 3 fields.
3. **Implement** supersede filter helper: `fn collect_superseded_ids(notes: &[(PathBuf, NoteFrontmatter)]) -> HashSet<String>`.
4. **Add** `Brief` variant vào `Commands` enum với clap args.
5. **Implement** `cmd_brief()` theo logic contract ở Section 6.
6. **Wire** `Commands::Brief` → `cmd_brief()` trong `main()` match arm.
7. **Write** unit tests (xem Section 8).
8. **Verify** `cargo test` passes — tất cả existing tests vẫn green.
9. **Verify** backward compat: tạo note giả không có 5 fields mới, confirm `parse_frontmatter()` không panic.

## 8. Verification & Risks

### Acceptance Criteria

- [ ] `pnotes brief --area src/foo` in đúng plain text format với 5 sections
- [ ] Items trong mỗi section có `(from: <note-id>, <date>)` attribution
- [ ] Note bị supersede không xuất hiện trong output (toàn bộ note bị loại)
- [ ] Empty brief in message hướng dẫn, exit code 0
- [ ] Notes cũ không có 5 fields mới vẫn parse thành công (no panic)
- [ ] `pnotes add continuity --decision "..." --invariant "..." --risk "..."` tạo note với fields được populate đúng
- [ ] `cargo test` all green sau khi implement

### Required Tests (thêm vào `mod tests`)

```
test_brief_empty()
  → 0 notes matching → output contains "No project memory found"

test_brief_superseded_excluded()
  → note-A superseded by note-B (note-B.supersedes = ["note-A-id"])
  → note-A's decisions/invariants không xuất hiện trong brief output

test_brief_two_notes_no_supersede()
  → 2 notes match, không supersede nhau, có decisions khác nhau
  → cả 2 sets of decisions đều xuất hiện, với đúng attribution

test_brief_backward_compat()
  → note không có 5 fields mới (legacy format)
  → parse_frontmatter() thành công, brief in "(none)" cho các sections đó

test_add_continuity_with_capture_flags()
  → pnotes add continuity --decision "D1" --invariant "I1" --risk "R1"
  → parse note file ra, fm.decisions == ["D1"], fm.invariants == ["I1"], fm.risks == ["R1"]
```

### Regression Risks

- **NoteFrontmatter schema change** (thêm 5 fields): Thấp — `#[serde(default)]` xử lý backward compat. Tuy nhiên phải verify tất cả existing tests vẫn pass.
- **cmd_recall() không thay đổi**: Cần confirm output không bị ảnh hưởng.
- **Supersede filter chỉ dùng trong cmd_brief()**: Không ảnh hưởng cmd_recall().

### Evidence Required

- Output của `cargo test` (all tests pass)
- Output của `pnotes brief --area <some-area>` với ít nhất 1 note có populated fields
- Output của `pnotes brief --area <area-with-no-notes>` (empty brief message)

## 9. Do Not Do

- KHÔNG update `cmd_recall()` hay `score_note()` — reuse as-is.
- KHÔNG thêm `--file` filter hay `files:` frontmatter field.
- KHÔNG implement deduplication across notes.
- KHÔNG thêm hard token truncation hay token counting logic.
- KHÔNG update `cmd_guide()` / `pnotes guide` help text — Phase-2.
- KHÔNG thêm dependency mới (serde_json, tokenizer, v.v.).
- KHÔNG thêm `--symbol` filter.
- KHÔNG parse source code — chỉ aggregate từ frontmatter.
- KHÔNG auto-resolve conflicts khi 2 notes không supersede nhau có decisions khác nhau —
  hiển thị cả hai với attribution để agent tự quyết.

---

*Party-mode session: BA, Customer Advocate, PO, Technical Lead (QA unavailable — rate limit).
Secretary: Orchestrator. Output format locked via Challenge Round. Guide update deferred via
Circuit Breaker (aligns with intent snapshot). Generated: 2026-05-25.*
