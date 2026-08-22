# Progress Log — review-web skill

Rolling log for this skill only. Read at the start of every invocation, updated at the end.
Newest entry on top.

---

## Current state

Skill created 2026-08-19, as one of four domain review skills (api/web/infra/harness) sharing
`.claude/skills/review-shared/`'s procedure, rubric, checklist, and cleanup script. Zero review
cycles completed yet. One entry seeded in `feature-list.json` from real pending work: the
un-PR'd `fix/autosave-race-guard` branch.

## Log

### 2026-08-19 — skill created, no cycles run yet

Built per explicit instruction alongside review-api/review-infra/review-harness. Reuses
`/code-review` for generic correctness, adds a frontend-specific harness-compliance pass (root
`AGENTS.md` §2 invariants as they apply to `apps/web`). Stops before merge by design — a human
approves each PR, matching the existing devops-workstream convention.
