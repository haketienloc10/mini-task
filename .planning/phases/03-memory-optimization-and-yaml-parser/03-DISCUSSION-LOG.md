# Phase 3: Memory Optimization and YAML Parser - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 3-Memory Optimization and YAML Parser
**Areas discussed:** Output memory, Terminal event pressure, YAML parser

---

## Output Memory

| Option | Description | Selected |
|--------|-------------|----------|
| Bound in-memory, keep full artifacts | Keep full `stdout.log`/`stderr.log` in run artifacts, but only bounded output in RAM/UI/result. | ✓ |
| Bound everything | Cut both RAM and artifacts by limit. | |
| Stream-only final message | Keep only parsed final agent data and rely on stream/logs separately. | |

**User's choice:** Bound in-memory, keep full artifacts.
**Notes:** Subsequent choices locked tail window per stream, 1 MiB per stream default, and incremental Codex JSON parsing while streaming.

---

## Terminal Event Pressure

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix appendTerminalEvent pressure | Avoid reading/parsing all terminal events after every output chunk. | ✓ |
| Only runner memory for now | Focus only on `runner.mjs`. | |
| Minimal mitigation only | Optimize the write path without broader terminal read changes. | |

**User's choice:** Yes, fix `appendTerminalEvent()` pressure.
**Notes:** User also chose updated task without `terminalEvents` hydration, separate terminal reads with limits, latest 1,000 event default, and exposed truncation metadata.

---

## YAML Parser

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve current flattened lookup | Use `js-yaml` but retain current metadata key behavior and fallbacks. | ✓ |
| Switch to nested object access only | Use YAML-native nested object access. | |
| Support both without flatten helper | Check nested and flattened keys manually per field. | |

**User's choice:** Preserve current flattened lookup.
**Notes:** User also chose silent skip for invalid YAML, string-only metadata values, and targeted parser compatibility tests.

---

## the agent's Discretion

None.

## Deferred Ideas

None.
