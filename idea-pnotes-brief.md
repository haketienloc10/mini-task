# Intent Snapshot — Project Notes as Change Safety Brief

## Context

Tôi đang phát triển ý tưởng `.project-notes/` và Rust CLI `pnotes`.

Phase 1 MVP hiện tại đã có hướng:

- Markdown note là source of truth.
- CLI là recall/helper layer.
- Notes nằm trong `.project-notes/notes/*.md`.
- Note có YAML frontmatter để recall.
- CLI có thể `init`, `add continuity`, `recall`, `show`, `guide`.
- Mục tiêu ban đầu là giúp agent/human không mất continuity sau mỗi lần thực thi Execution Handoff.

Tuy nhiên, sau khi suy nghĩ ngược từ nhiệm vụ thật sự của agent, tôi thấy `pnotes` không nên chỉ là nơi recall “lần trước agent gặp gì”.

Bài toán đúng hơn là:

> Khi tôi cần implement hoặc sửa chức năng A trong file F1, với tên function/symbol sẽ sửa là fn_x, thì agent cần những thông tin gì để sửa code chắc chắn nhất mà không phải đọc lại toàn bộ source base?

Nói cách khác, `pnotes` nên tiến hóa từ “note recall” thành “change safety context”.

## Core Reframe

Thay vì bắt đầu từ câu hỏi:

> Một Continuity Note nên chứa gì?

Hãy bắt đầu từ câu hỏi:

> Trước khi sửa code, agent cần biết gì để không scan toàn repo nhưng vẫn sửa đúng, không phá behavior cũ, không lặp lại dead end, và biết test nào cần chạy?

Với input tối thiểu:

    feature: A
    file: F1
    function/symbol: fn_x
    mô tả behavior mong muốn: ...

CLI nên trả về một bản brief ngắn, có cấu trúc, giúp agent biết:

1. Behavior contract của chức năng A.
2. Decisions đã chốt quanh vùng code này.
3. Invariants không được phá.
4. Known traps/gotchas.
5. Rejected approaches/dead ends.
6. Tests hiện có đang bảo vệ behavior nào.
7. Missing tests hoặc vùng chưa được bảo vệ.
8. Blast radius khi sửa file/function này.
9. Required read set: cần đọc file nào, không cần đọc toàn repo.
10. Safe change boundary: được sửa gì, tránh sửa gì.
11. Expected validation trước khi done.
12. Recent continuity notes liên quan cần đọc sâu nếu cần.

## Desired CLI Direction

Hiện tại `pnotes recall` trả danh sách notes liên quan.

Tôi muốn thêm hoặc tiến hóa thành command:

    pnotes brief --file F1 --symbol fn_x --feature A

hoặc đơn giản hơn:

    pnotes brief --area src/session-manager --symbol resumeSession

Output của command này không chỉ là list note, mà là một **Change Safety Brief**.

## Proposed Output: Change Safety Brief

Ví dụ output mong muốn:

    # Change Safety Brief

    ## target
    feature: A
    file: F1
    symbol: fn_x

    ## behavior_contract
    - Input hợp lệ là gì?
    - Output hoặc side effect mong đợi là gì?
    - Case nào phải reject?
    - Case nào phải giữ backward compatibility?
    - Trạng thái nào không được thay đổi?

    ## decisions
    - Decision đã chốt liên quan đến feature/file/symbol này.

    ## invariants
    - Những điều không được phá khi sửa code.

    ## known_traps
    - Bẫy hoặc gotcha đã biết quanh vùng code này.

    ## rejected_approaches
    - Hướng đã thử và bị loại, kèm lý do.

    ## validation_map
    existing_tests:
      - command: ...
        covers:
          - behavior được bảo vệ
    missing_tests:
      - behavior chưa có automated test bảo vệ
    manual_checks:
      - bước smoke/manual validation cần làm nếu cần

    ## blast_radius
    likely_affected:
      - vùng có khả năng bị ảnh hưởng
    unlikely_affected:
      - vùng không nên đụng tới mặc định

    ## required_read_set
    must_read:
      - file bắt buộc đọc
    read_if_needed:
      - file chỉ đọc nếu phát sinh nghi vấn
    do_not_read_by_default:
      - vùng không cần scan mặc định

    ## safe_change_boundary
    allowed_changes:
      - loại thay đổi được phép
    avoid_changes:
      - thay đổi nên tránh nếu không được yêu cầu rõ

    ## expected_validation
    must_run:
      - command test/typecheck/build bắt buộc
    should_run_if_touched:
      - command phụ thuộc vùng bị sửa
    manual_validation:
      - bước kiểm tra thủ công nếu automated coverage chưa đủ

    ## recent_continuity
    - note path + one-line signal

## Why This Matters

Nếu chỉ có `pnotes recall`, agent biết:

> Có note nào liên quan tới vùng này không?

Nhưng khi sửa code thật, agent cần nhiều hơn:

> Tôi được phép sửa gì?
> Không được phá invariant nào?
> Decision nào đã chốt rồi?
> Test nào đang bảo vệ behavior?
> Behavior nào chưa có test?
> Nên đọc file nào để đủ context?
> Không nên scan hoặc refactor vùng nào?
> Cần validate thế nào trước khi done?

Vì vậy, `pnotes brief` mới là command thực sự giúp agent sửa code chắc chắn hơn.

## Difference Between Recall and Brief

### `pnotes recall`

Mục tiêu:

- Tìm notes liên quan.
- Trả về path, signal, read_when.
- Giúp agent quyết định note nào cần đọc.

Ví dụ:

    pnotes recall --area src/session-manager --limit 3

Output kiểu:

    Found 2 relevant notes:

    1. 2026-05-25-agent-work-cockpit
       path: .project-notes/notes/2026-05-25-agent-work-cockpit.md
       signal: Session id capture is fragile; prefer explicit stdout marker.
       read_when: touching session capture, changing resume flow, parsing CLI stdout

### `pnotes brief`

Mục tiêu:

- Tổng hợp change safety context.
- Trả về những thông tin cần biết trước khi sửa code.
- Không chỉ liệt kê note.
- Không yêu cầu agent đọc toàn bộ source base.

Ví dụ:

    pnotes brief --area src/session-manager --symbol resumeSession

Output kiểu:

    Project Notes Brief

    Area: src/session-manager
    Symbol: resumeSession

    Relevant notes:
    - .project-notes/notes/2026-05-25-agent-work-cockpit.md
      signal: Session id capture should not rely on arbitrary terminal output parsing.

    Decisions:
    - Use explicit machine-readable session markers instead of arbitrary stdout parsing.

    Invariants:
    - Stored session id must map to exactly one agent execution.
    - Failed resume must not overwrite the previous valid session id.

    Known risks:
    - CLI output format may change between versions.

    Existing tests:
    - npm test -- session-manager
      covers: resume existing session, create new session when missing id

    Missing tests:
    - No automated test currently protects browser-close-does-not-kill-subprocess.

    Required read set:
    - src/session-manager/resume.ts
    - src/cli-runner/startProcess.ts
    - src/session-store/index.ts

    Expected validation:
    - npm test -- session-manager
    - npm run typecheck

## Required Information Groups

Khi implement chức năng A trong file F1/function fn_x, agent cần các nhóm thông tin sau.

### 1. behavior_contract

Mục tiêu: biết behavior đúng là gì.

Cần trả lời:

- Input hợp lệ là gì?
- Output mong đợi là gì?
- Side effect nào được phép?
- Error case nào phải giữ?
- Backward compatibility nào bắt buộc?
- Trạng thái nào không được thay đổi?

Ví dụ:

    behavior_contract:
      - Must resume the exact previous agent session when a stored session id exists.
      - Must create a new session only when no stored session id exists.
      - Must not kill an existing subprocess when browser UI closes.
      - Must persist session id before returning success to UI.

### 2. local_ownership

Mục tiêu: giới hạn vùng code cần đọc.

Cần biết:

- primary file;
- primary function/symbol;
- callers trực tiếp;
- callees trực tiếp;
- related files;
- test files liên quan.

Ví dụ:

    local_ownership:
      primary_file: src/session-manager/resume.ts
      primary_symbol: resumeSession
      callers:
        - src/task-board/actions.ts:createResumeAction
        - src/api/tasks.ts:POST /tasks/:id/resume
      callees:
        - src/cli-runner/startProcess.ts
        - src/session-store/saveSession.ts
      related_files:
        - src/session-store/index.ts
        - src/types/session.ts

### 3. decisions

Mục tiêu: biết các quyết định đã chốt để không đi ngược.

Ví dụ:

    decisions:
      - Use explicit machine-readable session markers instead of arbitrary stdout parsing.
      - Browser close must not kill long-running agent subprocess.
      - Session id belongs to task execution, not user session.

### 4. invariants

Mục tiêu: biết điều không được phá.

Ví dụ:

    invariants:
      - Existing task id must remain stable.
      - Stored session id must map to exactly one agent execution.
      - Resume must not create duplicate active subprocesses for the same task.
      - Failed resume must not overwrite the previous valid session id.

### 5. known_traps

Mục tiêu: tránh bẫy đã biết.

Ví dụ:

    known_traps:
      - CLI stdout format is not stable across versions.
      - Some agent CLIs print session id after process start, not before.
      - Closing browser does not mean task should stop.
      - Windows/WSL path behavior may differ when spawning subprocesses.

### 6. rejected_approaches

Mục tiêu: tránh lặp lại hướng đã bị loại.

Ví dụ:

    rejected_approaches:
      - approach: Parse arbitrary terminal output for session id.
        reason: Brittle across CLI versions.
      - approach: Tie subprocess lifecycle to browser websocket connection.
        reason: User can close browser while agent should continue.

### 7. validation_map

Mục tiêu: biết test nào bảo vệ behavior nào.

Không chỉ cần command test. Cần biết test đó cover gì.

Ví dụ:

    validation_map:
      existing_tests:
        - command: npm test -- session-manager
          covers:
            - resume existing session
            - create new session when missing id
        - command: cargo test -p pnotes-cli
          covers:
            - note parsing
            - recall scoring

      missing_tests:
        - no test for browser-close-does-not-kill-subprocess
        - no test for duplicate resume request

      manual_checks:
        - create task
        - assign agent
        - start session
        - close browser
        - reopen task
        - resume same session

Nếu không có test thì phải ghi rõ:

    missing_tests:
      - "No automated test currently protects this behavior."

### 8. blast_radius

Mục tiêu: biết sửa F1/fn_x có thể ảnh hưởng gì.

Ví dụ:

    blast_radius:
      likely_affected:
        - task resume flow
        - subprocess lifecycle
        - session persistence
        - UI task status display
      unlikely_affected:
        - task creation
        - project settings
        - authentication

### 9. required_read_set

Mục tiêu: tránh scan toàn repo nhưng vẫn đọc đủ.

Ví dụ:

    required_read_set:
      must_read:
        - src/session-manager/resume.ts
        - src/cli-runner/startProcess.ts
        - src/session-store/index.ts
        - tests/session-manager.test.ts
      read_if_needed:
        - src/api/tasks.ts
        - src/ui/task-detail.tsx
      do_not_read_by_default:
        - src/auth/
        - src/settings/
        - docs/

### 10. safe_change_boundary

Mục tiêu: ngăn agent tiện tay refactor hoặc mở rộng scope.

Ví dụ:

    safe_change_boundary:
      allowed_changes:
        - modify resumeSession behavior
        - add or adjust tests for resume flow
        - update session marker parsing only if needed
      avoid_changes:
        - do not refactor cli-runner globally
        - do not change task schema unless explicitly required
        - do not rename public API fields

### 11. expected_validation

Mục tiêu: biết điều kiện done.

Ví dụ:

    expected_validation:
      must_run:
        - npm test -- session-manager
        - npm run typecheck
      should_run_if_touched:
        - npm test -- cli-runner
      manual_validation:
        - start task
        - capture session id
        - close browser
        - reopen task
        - resume same session

Nếu không chạy được test, agent phải ghi rõ:

    validation_status:
      - not run: npm test -- session-manager
        reason: dependency install missing

### 12. recent_continuity

Mục tiêu: biết note nào cần đọc sâu nếu cần.

Ví dụ:

    recent_continuity:
      - path: .project-notes/notes/2026-05-25-agent-work-cockpit.md
        signal: Session id capture should not rely on arbitrary terminal output parsing.
      - path: .project-notes/notes/2026-05-26-browser-close-followup.md
        signal: Browser close must not kill subprocess.

## Proposed Frontmatter Expansion

Để `pnotes brief` có thể hoạt động, note frontmatter cần giàu thông tin hơn.

Hiện tại frontmatter kiểu:

    ---
    id: 2026-05-25-agent-work-cockpit
    type: continuity
    task: agent-work-cockpit
    run: RUN-0001
    handoff: ../handoffs/agent-work-cockpit-execution-handoff.md
    created_at: 2026-05-25
    areas:
      - src/session-manager
    tags:
      - resume-flow
    signal: "Session id capture is fragile; prefer explicit stdout marker."
    read_when:
      - "touching session capture"
    supersedes: []
    ---

Đề xuất thêm optional fields:

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

    files:
      - src/session-manager/resume.ts
      - src/cli-runner/startProcess.ts

    symbols:
      - resumeSession
      - startAgentProcess

    tags:
      - resume-flow
      - subprocess
      - codex-session

    signal: "Session id capture should not rely on arbitrary terminal output parsing."

    read_when:
      - "touching session capture"
      - "changing resume flow"
      - "parsing CLI stdout"

    decisions:
      - "Use explicit machine-readable session markers instead of arbitrary stdout parsing."

    invariants:
      - "Stored session id must map to exactly one agent execution."
      - "Failed resume must not overwrite the previous valid session id."

    risks:
      - "CLI output format may change between versions."

    tests:
      - command: "npm test -- session-manager"
        covers:
          - "resume existing session"
          - "create new session when missing id"

    missing_tests:
      - "No automated test currently protects browser-close-does-not-kill-subprocess."

    required_read_set:
      must_read:
        - src/session-manager/resume.ts
        - src/cli-runner/startProcess.ts
      read_if_needed:
        - src/api/tasks.ts
      do_not_read_by_default:
        - src/auth/

    safe_change_boundary:
      allowed:
        - "Modify resumeSession behavior."
        - "Add or adjust tests for resume flow."
      avoid:
        - "Do not refactor cli-runner globally."
        - "Do not change task schema unless explicitly required."

    expected_validation:
      must_run:
        - "npm test -- session-manager"
        - "npm run typecheck"
      manual:
        - "create task -> assign agent -> start session -> reopen task -> resume same session"

    supersedes: []
    ---

Important: these fields should be optional in early MVP, but if present, `pnotes brief` should use them.

## Relationship With Continuity Note Body

The body should still remain compact and retrospective.

Body should not become a changelog.

Current 6 body sections can stay:

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

Rule:

- Frontmatter is for recall and brief generation.
- Body is for human-readable execution continuity.
- Do not add `what_i_did`, `summary`, `implementation_details`, or `files_changed`.

## Anti-Scan Principle

The goal is not to prevent reading code.

The goal is to prevent reading unrelated code.

`pnotes brief` should help agent choose a small, relevant read set.

Good behavior:

    Agent reads:
    - current task/handoff
    - pnotes brief
    - must_read files
    - selected relevant notes

Bad behavior:

    Agent recursively scans:
    - entire src/
    - all .project-notes/notes/
    - all docs/
    - unrelated historical runs

## Proposed LLM Usage Rule

Before editing code, an agent should do:

    1. Identify target feature, file, and symbol/function if known.
    2. Run `pnotes brief --file <file> --symbol <symbol>` if available.
    3. If brief is empty, run `pnotes recall --area <area> --limit 3`.
    4. Read only returned notes and required_read_set.
    5. Implement surgical change.
    6. Run expected validation.
    7. If implementation output exists, write/update a continuity note.
    8. Do not scan all notes or all source unless blocked.

## Questions For Grillme

Please challenge this direction before turning it into implementation.

I want grillme to explore:

1. Is `pnotes brief` the right next step after `pnotes recall`?
2. Are the 12 information groups too much for MVP?
3. Which fields are mandatory, optional, or phase-2 only?
4. Should `behavior_contract` live in project notes, or should it live in Handoff/spec docs and only be linked from pnotes?
5. Should `tests`, `missing_tests`, and `expected_validation` be first-class frontmatter fields?
6. Should `required_read_set` be manually authored, generated, or both?
7. Should `local_ownership` be maintained by pnotes, or is that too close to code indexing?
8. Should `decisions` and `invariants` be separate note types instead of fields on continuity notes?
9. Should `brief` aggregate across many notes or only return top notes with extracted metadata?
10. How should conflicts be handled when two notes disagree?
11. How should `supersedes` work for decisions/invariants/tests?
12. Should `pnotes brief` fail when no relevant notes exist, or return an empty brief with guidance?
13. How short should CLI output be for LLM context?
14. What is the smallest useful MVP for `pnotes brief`?
15. How do we prevent this from becoming stale documentation?

## My Current Preferred Direction

I think `pnotes` should become a project-local safety memory.

Not a full memory database.
Not a semantic search engine.
Not a replacement for tests or specs.
Not a replacement for source reading.

It should be a small CLI that helps agent answer:

    "Before I modify this feature/file/function, what project-local knowledge should I know?"

Preferred model:

    Markdown is source of truth.
    YAML frontmatter powers recall and brief generation.
    Body captures retrospective continuity.
    CLI returns small, deterministic, LLM-friendly summaries.
    Agent reads only relevant notes and required files.
    Tests/proof/invariants/decisions become visible before code changes.

Preferred next command:

    pnotes brief --file <path> --symbol <symbol> --feature <name>

or:

    pnotes brief --area <area> --tag <tag>

Desired outcome:

When implementing function A in file F1, the agent should get:

    1. behavior contract
    2. decisions already made
    3. invariants that must not break
    4. known traps and rejected approaches
    5. tests that protect the behavior
    6. missing tests
    7. blast radius
    8. required read set
    9. safe change boundary
    10. expected validation
    11. recent relevant continuity notes

Please grill this direction and help reduce it to the smallest useful next phase.
