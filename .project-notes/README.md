# .project-notes

Thư mục lưu trữ execution notes cấp project, dùng để agents và humans recall context giữa các session.

## Schema Reference

### Frontmatter (YAML)

**Required fields:**

| Field | Type | Description |
|---|---|---|
| `id` | string | `{YYYY-MM-DD}-{task-slug}` — auto-generated khi tạo |
| `type` | string | `"continuity"` — loại note (MVP: chỉ continuity) |
| `task` | string | Task slug từ `--task` arg |
| `created_at` | string | `YYYY-MM-DD` — auto từ current date |
| `signal` | string | One-line summary từ `--signal` arg |

**Optional fields:**

| Field | Type | Description |
|---|---|---|
| `run` | string | Run/session identifier |
| `handoff` | string | Relative path to handoff document |
| `areas` | list | Code areas affected (e.g. `src/auth`) |
| `tags` | list | Tags for filtering |
| `read_when` | list | Trigger conditions (agent tự điền) |
| `supersedes` | list | IDs của notes bị supersede |

### Body template

```markdown
## task
{task-slug} — {run-id} — {handoff-link}

## deviations
None

## traps
None

## dead_ends
None

## validation_delta
As expected

## next_agent_hint
See Handoff
```

## Filename Pattern

```
.project-notes/notes/{YYYY-MM-DD}-{task-slug}.md
```

Collision (cùng date + task-slug): tự động append suffix `-2`, `-3`, etc.

## Immutability

- Notes không được sửa sau khi tạo
- Để supersede: tạo note mới với `supersedes: [old-id]`
- Không có `pnotes edit` hoặc `pnotes delete`

## Rebuild binary

Nếu cần rebuild `bin/pnotes` từ source:

```bash
cd pnotes-cli
cargo build --release
cp target/release/pnotes ../bin/pnotes
```

Requirements: Rust toolchain (rustc + cargo). Tested trên Linux/WSL2.

Source: `pnotes-cli/src/main.rs`
