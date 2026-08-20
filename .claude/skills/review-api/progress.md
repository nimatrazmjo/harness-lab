# Progress Log — review-api skill

Rolling log for this skill only. Read at the start of every invocation, updated at the end.
Newest entry on top.

---

## Current state

Skill created 2026-08-19, as one of four domain review skills sharing
`.claude/skills/review-shared/`. Zero review cycles run — no pending `apps/api` work at creation
time.

## Log

### 2026-08-19 — skill created, no cycles run yet

Built per explicit instruction alongside review-web/review-infra/review-harness. Reuses
`/code-review` for generic correctness, adds a backend-specific harness-compliance pass (root
`AGENTS.md` §2's invariants — most of them bind hardest here: SECRETS, PERSISTENCE,
TENANT-ISOLATION, VERSION-IMMUTABILITY, POOLING, CONTEXT-INJECTION). Stops before merge by
design.
