# Progress Log — review-infra skill

Rolling log for this skill only. Read at the start of every invocation, updated at the end.
Newest entry on top.

---

## Current state

Skill created 2026-08-19, as one of four domain review skills sharing
`.claude/skills/review-shared/`. Zero review cycles run — devops PRs #18–#23 already went through
their own review cycles individually before this skill existed.

## Log

### 2026-08-19 — skill created, no cycles run yet

Built per explicit instruction alongside review-api/review-web/review-harness. Reuses
`/code-review` for generic correctness, adds `devops/AGENTS.md`'s existing non-negotiables
directly as the harness-compliance pass (no static creds, never root, never `latest`, terraform
apply CI-only). Includes the same hard root-credential breakpoint as `devops/init.sh`. Stops
before merge by design.
