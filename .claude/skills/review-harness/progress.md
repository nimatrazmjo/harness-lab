# Progress Log — review-harness skill

Rolling log for this skill only. Read at the start of every invocation, updated at the end.
Newest entry on top.

---

## Current state

Skill created 2026-08-19, as one of four domain review skills sharing
`.claude/skills/review-shared/`. One entry retroactively logged (PR #23's real review cycle, the
precedent this skill's procedure was written from). No live cycle has run through this skill's
own dispatch flow yet.

## Log

### 2026-08-19 — skill created, PR #23's cycle logged retroactively

Built per explicit instruction alongside review-api/review-web/review-infra. Scope is the
meta-layer (AGENTS.md files, feature-list.json, checklists, skills, docs, tracking conventions),
not product/infra content. Harness-compliance pass focuses on internal consistency — dangling
references, `.claude`/`.agents` mirror sync, verifying against real remote branches (not local
state, per the exact mistake PR #23's second review pass made and this repo now has a named
lesson for). Stops before merge by design.
