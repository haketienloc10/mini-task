---
name: project-notes
description: Hướng dẫn agent sử dụng pnotes CLI để lưu và recall context thực thi giữa các session. Dùng khi bắt đầu hoặc kết thúc một task có thể cần context ở lần sau.
---

# SKILL: project-notes

## 1. Skill Identity

- **Skill name:** `project-notes`
- **Purpose:** Cho phép agent recall context từ execution trước và ghi lại context của session hiện tại vào repo, không cần memory ngoài repo.
- **Tool:** `bin/pnotes` — Rust CLI binary, committed vào repo tại `bin/pnotes`.
- **Storage:** `.project-notes/notes/*.md` — plain Markdown files với YAML frontmatter.

## 2. When to Use

### Dùng khi bắt đầu task

Trước khi bắt đầu làm việc trong một area hoặc task đã có lịch sử trước:

```bash
./bin/pnotes recall --task <slug>
./bin/pnotes recall --area <path>
```

Ưu tiên đọc note trả về trước khi bắt đầu implement.

### Dùng khi kết thúc session

Sau khi hoàn thành công việc đủ để để lại context cho session sau:

```bash
./bin/pnotes add continuity \
  --task <slug> \
  --signal "<one-line tóm tắt điều quan trọng nhất>" \
  --area <code-area> \
  [--handoff <path-to-handoff>]
```

Sau khi tạo note, mở file và điền vào các section `deviations`, `traps`, `dead_ends`, `validation_delta`, `next_agent_hint`.

### Không cần dùng khi

- Task hoàn toàn mới, không có context lịch sử
- Task nhỏ, kết quả rõ ràng, không cần recall sau
- Task chỉ là Q&A hoặc đọc file thuần túy

## 3. Command Reference

```bash
# Khởi tạo (chỉ cần chạy 1 lần)
./bin/pnotes init

# Recall context trước khi làm việc
./bin/pnotes recall --area src/session-manager --limit 3
./bin/pnotes recall --task auth-fix
./bin/pnotes recall --tag bug

# Tạo note sau khi hoàn thành
./bin/pnotes add continuity \
  --task auth-fix \
  --signal "JWT expiry edge case fixed in middleware" \
  --area src/auth \
  --tag bug \
  --handoff auth-fix-execution-handoff.md

# Đọc full content của một note
./bin/pnotes show 2026-05-25-auth-fix

# In workflow guide
./bin/pnotes guide
```

## 4. Note Structure

Mỗi note được lưu tại `.project-notes/notes/{YYYY-MM-DD}-{task-slug}.md`.

**Frontmatter (tự động tạo):**
```yaml
id: "2026-05-25-auth-fix"
type: "continuity"
task: "auth-fix"
created_at: "2026-05-25"
signal: "JWT expiry edge case fixed in middleware"
areas:
  - src/auth
tags:
  - bug
```

**Body (agent tự điền sau khi tạo):**
```markdown
## task
auth-fix — handoff link

## deviations
None hoặc mô tả deviation so với handoff

## traps
Những bẫy đã gặp trong quá trình làm

## dead_ends
Hướng đã thử nhưng không work

## validation_delta
Kết quả so với expected

## next_agent_hint
Gợi ý cho agent tiếp theo
```

## 5. Recall Scoring

`pnotes recall` dùng scoring algorithm sau (cộng dồn):

| Match type | Score |
|---|---|
| Area exact match | +5 |
| Area prefix match (parent/child path) | +4 |
| Task exact match | +3 |
| Tag match (mỗi tag) | +2 |
| Text match trong signal/read_when | +2 |
| Recency boost (newest note) | +1 |

Tie-break: `created_at` DESC (newer first).

**Ví dụ prefix match:**
- Note area: `src/session-manager`, query `--area src/` → prefix match (+4) ✅
- Note area: `src/`, query `--area src/session-manager` → prefix match (+4) ✅
- Note area: `src/session-manager`, query `--area src/session-manager` → exact match (+5) ✅

## 6. Guardrails

- **Không sửa note sau khi tạo** — notes là immutable. Nếu cần override: tạo note mới với `supersedes: [old-id]`.
- **Không commit** `.project-notes/notes/` note files nếu chứa thông tin nhạy cảm (credentials, PII).
- **Binary path:** `./bin/pnotes` từ repo root. Nếu gặp permission error: `chmod +x bin/pnotes`.
- **Rebuild binary:** Xem `.project-notes/README.md` nếu cần rebuild từ source.
