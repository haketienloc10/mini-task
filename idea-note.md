# Idea Note — Project Notes CLI for Execution Continuity

## Context

Tôi đang thiết kế một cơ chế giúp agent/human tiếp tục công việc tốt hơn sau mỗi lần thực thi một Execution Handoff.

Vấn đề ban đầu:

- Sau khi một agent thực thi xong Handoff, nó thường có một số bài học quan trọng:
  - có deviation so với plan;
  - có trap/gotcha không nằm trong Handoff;
  - có dead end đã thử và loại bỏ;
  - validation có điểm khác expected;
  - agent tiếp theo nên biết gì khi quay lại vùng code này.
- Những thông tin này không nên nằm trong git diff, commit message, hoặc Handoff gốc.
- Nếu không ghi lại, agent tiếp theo dễ lặp lại lỗi cũ hoặc phải rediscover context.
- Nếu ghi quá nhiều note rời rạc, về sau lại gặp vấn đề recall: agent không biết note nào cần đọc.

Ý tưởng hiện tại: tạo một hệ thống `.project-notes/` kèm một Rust CLI nhỏ để store và recall note.

Mục tiêu không phải tạo memory system phức tạp. Mục tiêu là tạo một project-level note manager đơn giản, human-readable, git-trackable, và dễ dùng cho LLM.

## Core Problem

Tôi muốn giải quyết bài toán:

> Sau mỗi execution, làm sao lưu lại những bài học quan trọng cho người/agent sau mà không tạo documentation rác, không bắt agent đọc toàn bộ archive, và không phụ thuộc vào memory ngoài repo?

Các vấn đề cần cân bằng:

1. Notes phải đủ nhẹ để executor chịu viết.
2. Notes phải immutable để giữ lịch sử execution.
3. Notes phải có metadata để recall được.
4. LLM phải có hướng dẫn rõ ràng để biết nên gọi CLI như thế nào.
5. Markdown vẫn phải là source of truth, không bị lock vào database.
6. CLI chỉ là recall/helper layer, không thay thế repo artifacts.
7. Không biến system này thành một platform quá lớn ngay từ đầu.

## Current Direction

Tạo thư mục:

    .project-notes/
      README.md
      notes/
        2026-05-25-agent-work-cockpit.md
        2026-05-26-session-resume-followup.md
      index.json

Trong đó:

- `.project-notes/notes/*.md` là source of truth.
- Mỗi note là markdown có YAML frontmatter.
- `index.json` là generated index/cache, có thể rebuild từ notes.
- Rust CLI đọc markdown, parse frontmatter, build index, recall note liên quan.
- LLM không scan toàn bộ `.project-notes/notes`; thay vào đó gọi CLI để lấy danh sách note cần đọc.

## Why `.project-notes/`

Tôi không muốn dùng `.agents/` vì đây không phải config/runtime/instruction riêng cho agent.

Tên `.project-notes/` hợp hơn vì:

- Đây là tài nguyên của project, nhiều người và nhiều agent có thể dùng.
- Không bị khóa vào một agent framework cụ thể.
- Có thể chứa nhiều loại note về sau:
  - continuity note;
  - decision note;
  - investigation note;
  - migration note;
  - trap note.
- Trung tính, dễ hiểu, không quá “AI-agent specific”.

## Note Type: Continuity Note

Continuity Note là loại note đầu tiên.

Nó được tạo sau khi một Execution Handoff đã được thực thi và có implementation output.

Nó không bắt buộc nếu:

- Handoff mới được tạo nhưng chưa thực thi.
- Task chỉ là planning/investigation/review, không đổi code, không merge gì.
- Không có implementation output.

Không có complexity threshold. Task đơn giản vẫn có thể tạo note rất ngắn.

## Continuity Note Body

Body có 6 field bắt buộc:

    ## task
    {task-slug} — {execution-id/run-id if any} — {handoff link}

    ## deviations
    Những gì đã làm khác so với Handoff — hoặc "None"

    ## traps
    Constraint ẩn, gotcha, điều kiện không có trong Handoff mà agent tiếp theo cần biết — hoặc "None"

    ## dead_ends
    Approach đã thử và bị loại, cùng lý do — hoặc "None"

    ## validation_delta
    Kết quả validation khác expected, validation không chạy được, hoặc "As expected"

    ## next_agent_hint
    Một điều quan trọng nhất agent tiếp theo nên biết khi làm việc ở vùng này — hoặc "See Handoff"

Không có field:

    ## what_i_did
    ## summary
    ## implementation_details
    ## files_changed

Lý do: những phần đó đã thuộc về git diff, commit message, evidence, hoặc Handoff. Continuity Note không phải changelog.

## Minimum Valid Continuity Note

    ---
    id: 2026-05-25-agent-work-cockpit
    type: continuity
    task: agent-work-cockpit
    run: RUN-0001
    handoff: ../handoffs/agent-work-cockpit-execution-handoff.md
    created_at: 2026-05-25
    areas:
      - src/task-board
    tags:
      - task-board
    signal: "No surprises."
    read_when:
      - "continuing agent-work-cockpit"
    supersedes: []
    ---

    ## task
    agent-work-cockpit — RUN-0001 — ../handoffs/agent-work-cockpit-execution-handoff.md

    ## deviations
    None

    ## traps
    None

    ## dead_ends
    None

    ## validation_delta
    As expected

    ## next_agent_hint
    See Handoff. No surprises.

## YAML Frontmatter

Frontmatter dùng để recall, không thay thế nội dung body.

Ví dụ:

    ---
    id: 2026-05-25-agent-work-cockpit
    type: continuity
    task: agent-work-cockpit
    run: RUN-0001
    handoff: ../handoffs/agent-work-cockpit-execution-handoff.md
    created_at: 2026-05-25
    areas:
      - src/session-manager
      - src/cli-runner
    tags:
      - codex-session
      - resume-flow
      - subprocess
    signal: "Session id capture is fragile; prefer explicit stdout marker."
    read_when:
      - "touching session capture"
      - "changing resume flow"
      - "parsing CLI stdout"
    supersedes: []
    ---

Ý nghĩa:

- `id`: stable note id.
- `type`: loại note, ban đầu là `continuity`.
- `task`: task slug.
- `run`: run id nếu có.
- `handoff`: link tới Execution Handoff.
- `created_at`: ngày tạo note.
- `areas`: vùng code/concept note liên quan.
- `tags`: keyword ngắn để filter.
- `signal`: một dòng high-signal nhất của note.
- `read_when`: khi nào nên đọc note này.
- `supersedes`: note nào bị note này thay thế một phần/toàn phần, nếu có.

## Example Detailed Continuity Note

    ---
    id: 2026-05-25-agent-work-cockpit
    type: continuity
    task: agent-work-cockpit
    run: RUN-0001
    handoff: ../handoffs/agent-work-cockpit-execution-handoff.md
    created_at: 2026-05-25
    areas:
      - src/session-manager
      - src/cli-runner
      - src/task-board
    tags:
      - codex-session
      - resume-flow
      - subprocess
      - validation
    signal: "Session id capture should not rely on arbitrary terminal output parsing."
    read_when:
      - "touching session capture"
      - "changing resume flow"
      - "parsing CLI stdout"
      - "modifying subprocess lifecycle"
    supersedes: []
    ---

    ## task
    agent-work-cockpit — RUN-0001 — ../handoffs/agent-work-cockpit-execution-handoff.md

    ## deviations
    The implementation used an explicit session marker instead of parsing arbitrary CLI output. This differs from the original Handoff wording, which allowed stdout parsing as an acceptable strategy.

    ## traps
    Codex/Claude CLI output is not guaranteed to keep a stable human-readable format. Any resume/session logic that depends on arbitrary terminal text is fragile.

    ## dead_ends
    Heuristic parsing of terminal output was considered and rejected because different agent CLIs may format session ids differently, and future CLI versions may change the text without warning.

    ## validation_delta
    As expected. Manual smoke validation confirmed that a task can be created, assigned to an agent, started, and later reopened with the stored session id.

    ## next_agent_hint
    Prefer explicit machine-readable session markers over heuristic parsing when integrating agent CLI sessions.

## Immutability Rule

Continuity Notes are immutable execution records.

Allowed amendments:

- typo;
- broken link;
- wrong relative path;
- formatting that does not change meaning.

Not allowed:

- rewrite conclusions;
- remove deviations;
- add newly discovered traps into an old note;
- change validation result;
- alter `next_agent_hint`.

If substantive information is discovered later, create a new note.

Example:

    .project-notes/notes/2026-05-25-agent-work-cockpit.md
    .project-notes/notes/2026-05-26-agent-work-cockpit-followup.md

New note can use `supersedes` if it replaces a previous assumption.

## Recall Problem

If every execution creates a new note, there will eventually be many notes.

The real problem becomes:

> How does an LLM know which notes to read without scanning everything?

A manual `CONTINUITY_INDEX.md` could work, but it can become stale and requires manual updates.

Better idea: write a small Rust CLI that turns `.project-notes/notes/*.md` into a queryable recall layer.

## Rust CLI Direction

CLI name candidates:

    pnotes
    project-notes

Preferred short name:

    pnotes

The CLI should not be a complex memory system. It should be a small project note manager.

Core responsibilities:

1. Initialize `.project-notes/`.
2. Create note from templates.
3. Validate note format.
4. Rebuild generated index.
5. Recall relevant notes by metadata.
6. Print LLM usage guide.

## MVP Commands

Minimum useful command set:

    pnotes init
    pnotes add continuity
    pnotes list
    pnotes recall --area src/session-manager --tag resume-flow --limit 3
    pnotes show 2026-05-25-agent-work-cockpit
    pnotes rebuild
    pnotes guide

### `pnotes init`

Creates:

    .project-notes/
      README.md
      notes/
      index.json

### `pnotes add continuity`

Creates a new markdown note from template.

Potential flags:

    pnotes add continuity \
      --task agent-work-cockpit \
      --run RUN-0001 \
      --area src/session-manager \
      --area src/cli-runner \
      --tag resume-flow \
      --signal "Session id capture is fragile; prefer explicit stdout marker."

### `pnotes recall`

Returns only matching notes, optimized for LLM reading.

Example:

    pnotes recall --area src/session-manager --limit 3

Output:

    Found 2 relevant notes:

    1. 2026-05-25-agent-work-cockpit
       path: .project-notes/notes/2026-05-25-agent-work-cockpit.md
       type: continuity
       signal: Session id capture is fragile; prefer explicit stdout marker.
       read_when: touching session capture, changing resume flow, parsing CLI stdout

    2. 2026-05-26-session-resume-followup
       path: .project-notes/notes/2026-05-26-session-resume-followup.md
       type: continuity
       signal: Browser close must not kill long-running subprocess.
       read_when: changing subprocess lifecycle, process cleanup

### `pnotes show`

Prints one full note by id.

    pnotes show 2026-05-25-agent-work-cockpit

### `pnotes guide`

Prints LLM-facing instructions.

Expected output:

    # Project Notes Usage Guide for LLMs

    Before changing code:
    1. Identify files/areas you expect to touch.
    2. Run `pnotes recall --area <path> --limit 3`.
    3. Read only the returned notes that match the current task.
    4. Do not scan all `.project-notes/notes`.
    5. After implementing an Execution Handoff, create a continuity note with `pnotes add continuity`.
    6. Notes are immutable execution records. Do not rewrite old notes except mechanical fixes.

## Recall Scoring

MVP scoring can be simple and deterministic.

Suggested scoring:

    +5 exact area match
    +4 area parent/child path match
    +3 task match
    +2 tag match
    +2 text match in signal/read_when
    +1 recent note boost

No embedding. No semantic search. No daemon. No SQLite in MVP.

If query matches many notes, output top N only.

## Generated Index

CLI can create:

    .project-notes/index.json

The markdown notes remain source of truth.

`index.json` is generated from frontmatter.

Open question: should `index.json` be committed?

Option A: Commit it.

Pros:

- Human/agent can inspect index without running CLI.
- Faster for simple environments.

Cons:

- Can become stale if someone edits note manually and forgets rebuild.

Option B: Do not commit it.

Pros:

- No stale generated file in git.

Cons:

- Requires CLI to rebuild before recall.

Possible compromise:

- Commit `index.json`.
- CLI validates freshness.
- README says: do not edit manually; run `pnotes rebuild`.

Need grillme to help decide.

## LLM Usage Pattern

Intended flow for an LLM/code agent:

    1. Read current user request / Execution Handoff.
    2. Identify likely touched areas.
    3. Run `pnotes recall --area <area> --limit 3`.
    4. Read returned notes only.
    5. Implement task.
    6. If implementation output exists, create continuity note.
    7. Run `pnotes rebuild` or let `pnotes add` update index.

Important constraint:

The LLM should not recursively scan all notes unless explicitly asked.

## Anti-Garbage Rules

1. No `what I did`.
2. No full implementation summary.
3. No copy-paste from git diff.
4. No duplicating Handoff.
5. Body should only contain:
   - deviation;
   - trap;
   - dead end;
   - validation delta;
   - next-agent hint.
6. If nothing special happened, write the minimum valid note.
7. If the note would only repeat git diff/Handoff/evidence, use `None` or `As expected`.

Signal test before writing:

> Is this information already obvious from git diff, Handoff, or evidence?

If yes, do not write it.

## Things I Want Grillme To Challenge

Please grill this idea before turning it into an implementation handoff.

I want you to challenge:

1. Is `.project-notes/` the right home, or should this live under `.harness/`?
2. Is a Rust CLI justified, or is this overengineering compared to a markdown index?
3. Is YAML frontmatter enough for recall?
4. Are `areas`, `tags`, `signal`, and `read_when` the right recall metadata?
5. Should `recall_keys` exist in the note body, or is frontmatter enough?
6. Should `index.json` be committed or generated only?
7. Should the CLI support only continuity notes in MVP, or have a generic note type from day one?
8. Should notes be immutable, or should there be a controlled amend command?
9. What is the smallest MVP that proves this is useful?
10. How should LLM instructions be written so agents actually use `pnotes recall` before touching code?
11. How to avoid this becoming another stale documentation system?
12. How to keep CLI output short enough for LLM context?
13. Should recall be path-based only, or also task/tag-based?
14. Should the CLI fail when frontmatter is incomplete?
15. How should superseding work without rewriting history?

## Desired Outcome From Grillme

I do not want implementation yet.

I want grillme to help clarify the requirement and produce an Execution Handoff only after the direction is solid.

The output I want from grillme:

1. Validate or challenge the core direction.
2. Identify missing decisions.
3. Propose a minimal MVP boundary.
4. Define the final artifact layout.
5. Define the final note schema.
6. Define CLI command behavior.
7. Define LLM usage guide.
8. Define anti-garbage rules.
9. Define open questions that must be answered before implementation.
10. When ready, produce an Execution Handoff for implementing the Rust CLI.

## Current Preferred Direction

My current preference:

    .project-notes/
      README.md
      notes/
        {date}-{task-slug}.md
      index.json

CLI:

    pnotes init
    pnotes add continuity
    pnotes recall --area <path> --limit 3
    pnotes show <id>
    pnotes rebuild
    pnotes guide

Note format:

    YAML frontmatter for recall
    +
    6-section markdown body for continuity

Philosophy:

    Markdown is the source of truth.
    CLI is the recall layer.
    Notes are immutable execution records.
    Index is generated.
    LLM reads guide, recalls relevant notes, then reads selected notes only.

Please grill this.
