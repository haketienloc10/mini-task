# Intent Snapshot: project-notes-cli

## Current Intent

Tạo một Rust CLI (`pnotes`) để quản lý project-level execution notes — giúp agent/human tiếp tục công việc sau mỗi Execution Handoff mà không cần đọc toàn bộ archive, không phụ thuộc memory ngoài repo, và không tạo documentation rác.

## Desired Outcome

- `pnotes-cli/` subdirectory trong `mini-task` repo chứa Rust source.
- `bin/pnotes` là pre-built Linux binary, committed vào repo.
- `.project-notes/notes/*.md` là source of truth — YAML frontmatter + 6-section markdown body.
- `pnotes recall --area <path> --limit 3` trả về relevant notes để agent đọc trước khi touch code.
- `.agents/skills/project-notes/SKILL.md` là adoption mechanism — agent đọc khi session start.

## Boundaries to Keep

- Markdown là source of truth. CLI không thay thế, chỉ hỗ trợ recall.
- Notes là immutable execution records. Không sửa kết luận cũ; tạo note mới.
- Không có embedding, semantic search, SQLite, hoặc daemon trong MVP.
- CLI output phải đủ ngắn để fit trong LLM context (recall output: top N notes, mỗi note 4–5 dòng).
- Body note chỉ chứa deviation, trap, dead end, validation delta, next-agent hint — không có summary hay implementation detail.

## Confirmed Decisions

1. **Language**: Rust CLI, standalone binary.
2. **Location**: `pnotes-cli/` subdirectory trong `mini-task` repo.
3. **Distribution**: Pre-built Linux binary committed ở `bin/pnotes`. Platform-specific; Linux-only là acceptable cho scope này.
4. **index.json**: Không commit. CLI scan markdown on-demand mỗi lần recall.
5. **`pnotes rebuild`**: Không có trong MVP. Không cần nếu không có index cache.
6. **`pnotes list`**: Không có trong MVP. `recall` không có filter là equivalent.
7. **Note type**: Chỉ `continuity` trong MVP.
8. **Adoption mechanism**: `.agents/skills/project-notes/SKILL.md` — cùng pattern với `grill-me` và `party-mode` đã có trong repo.

## MVP Command Set

```
pnotes init
pnotes add continuity [--task <slug>] [--area <path>]... [--tag <tag>]... [--signal "<text>"]
pnotes recall [--area <path>] [--tag <tag>] [--task <slug>] [--limit <n>]
pnotes show <id>
pnotes guide
```

## Note Schema

**YAML Frontmatter (recall layer):**

```yaml
id: {date}-{task-slug}
type: continuity
task: {task-slug}
run: {run-id}          # optional
handoff: {relative-path}
created_at: {YYYY-MM-DD}
areas:
  - src/...
tags:
  - ...
signal: "{one-line high-signal summary}"
read_when:
  - "{trigger condition}"
supersedes: []
```

**Markdown Body (6 sections bắt buộc):**

```markdown
## task
{task-slug} — {run-id} — {handoff-link}

## deviations
{text hoặc "None"}

## traps
{text hoặc "None"}

## dead_ends
{text hoặc "None"}

## validation_delta
{text hoặc "As expected"}

## next_agent_hint
{text hoặc "See Handoff"}
```

## Recall Scoring

```
+5  exact area match
+4  area parent/child path prefix match
+3  task match
+2  tag match
+2  text match trong signal hoặc read_when
+1  recent note boost (newer = higher)
```

Output top N notes. Không có embedding, semantic search, hoặc external index.

## Directory Layout

```
mini-task/
  pnotes-cli/
    src/
      main.rs
    Cargo.toml
  bin/
    pnotes             ← committed Linux binary (WSL2)
  .project-notes/
    README.md
    notes/
      {YYYY-MM-DD}-{task-slug}.md
  .agents/skills/
    project-notes/
      SKILL.md
```

## Current Assumptions

- Agent environment là Linux (WSL2) — committed Linux binary là acceptable.
- MVP có < 50 notes — on-demand markdown scan đủ nhanh (< 30ms).
- `pnotes add continuity` tạo file template; agent/human tự điền body — không interactive prompt.
- YAML frontmatter parse dùng `serde_yaml` hoặc simple line parser.
- Recall scoring là deterministic, không có randomness.

## Evaluation Criteria

- `pnotes recall --area src/X --limit 3` trả kết quả trong < 1s.
- `pnotes add continuity --task X --area Y --signal "..."` tạo file hợp lệ đúng schema.
- `pnotes guide` output đủ rõ để agent hiểu workflow mà không cần đọc README.
- Binary chạy trên WSL2 Linux không cần thêm dependency.
- Recall output fit trong một LLM message (< 500 tokens với 3 notes).

## Open Points

- **Frontmatter validation strictness**: Lean toward warn (exit 0) cho `recall`, hard fail cho `add` khi thiếu required field.
- **`areas` prefix matching**: `src/` phải match `src/session-manager` — cần implement path prefix logic trong scoring.
- **Tách repo**: Nếu `pnotes` prove useful sau MVP, có thể tách ra repo riêng (Option A2) để dùng ở nhiều project.

## Next Thinking Points

- `investigation`, `decision`, `trap` note types có thể thêm sau khi `continuity` tỏ ra useful.
- Index caching (`index.json`) có thể thêm sau khi note volume vượt 50.
- Cross-platform binary (macOS, Windows) là bước sau khi CLI stable.
