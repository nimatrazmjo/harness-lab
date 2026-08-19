---
name: review-harness
description: Review, fix, and prep for merge any pending changes to this repo's own harness (AGENTS.md files, feature-list.json, checklists, skills, docs, tracking conventions) — runs /code-review plus an internal-consistency pass, then stops for human merge approval. Use when there's new/unreviewed harness/meta-layer work, or the user asks to review AGENTS.md/skills/docs changes.
---

Domain config for the shared procedure in `.claude/skills/review-shared/PROCEDURE.md` — read that
first, this file only names the scope and domain-specific checks.

**Scope note:** like `devops-request-grant`, this skill's own operational state (`init.sh`, `feature-list.json`, `session-handoff.md`, `progress.md`, `graph.md`) lives only under `.claude/skills/review-harness/` — Claude Code specific, on purpose (its dispatch mechanics have no direct equivalent in every agent tool). `review-shared/PROCEDURE.md` is the authoritative procedure; this file and its state are one tool's implementation of it.

## Scope

The meta-layer, not product/infra content: root `AGENTS.md`, `CLAUDE.md`, `feature-list.json`,
`BUILD-CHECKLIST.md`, `sprint-contract.md`, `evaluator-rubric.md`, `clean-state-checklist.md`,
`progress.md`, `session-handoff.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`; `devops/AGENTS.md`
and its own tracking files; every `.claude/skills/**` and `.agents/skills/**` file;
`scripts/generate-feature-graph.py`; every `graph.md`. Never edit `apps/api/src/**`,
`apps/web/src/**`, `libs/**`, or Terraform/Dockerfile content under `devops/`/`infra/` as part of
a fix here — if a harness change genuinely requires a product/infra change (e.g. a new `/health`
route a Dockerfile needs), flag it rather than crossing the boundary, same discipline
`devops/AGENTS.md` already applies to itself.

## Harness-compliance pass (in addition to `/code-review`)

There's no single pre-existing invariants doc for this domain the way §2/`devops/AGENTS.md` cover
api/web/infra — the checks here are about the harness's own internal consistency, learned the
hard way this session:
- **No dangling forward references.** If a file/section is deleted or renamed, every
  *forward-looking* reference to it (a skill instruction, an `AGENTS.md` pointer, a "read X next"
  line) must be updated too. Historical/dated log entries (`progress.md`) are exempt — they're a
  record of what happened, not a live pointer — but a deliberate exemption should be stated, not
  silently assumed.
- **`.claude/skills/` and `.agents/skills/` mirrors stay in sync** for every `SKILL.md` — diff
  them, don't just eyeball them.
- **Verify fixes against the real remote branch, never local working-tree state** — this exact
  mistake (a review fork checking stale local duplicates instead of the actual pushed PR content)
  already happened once in this repo's history. Any review of harness changes should explicitly
  confirm it fetched/inspected the real branch.
- **Convention consistency across files.** A rule stated in one place (e.g. "never merge your own
  PR") must not be contradicted or silently weakened anywhere else that touches the same
  workflow.
- **`init.sh`/`cleanup.sh`-style scripts fail loudly, never silently.** A check that can't
  resolve (credentials, missing file) should say so, not pass by default.
- **No manufactured bureaucracy.** A new file/section should trace to a real need — this domain
  is the most tempting one to over-build for its own sake; call that out if a proposed addition
  doesn't clearly serve a grading criterion or a real failure already seen.

## Toolchain (`init.sh` checks)

`git`, `gh`, `jq`, `python3`. `markdownlint` if present (soft check, not required — not every
environment has it installed).

## `feature-list.json`

Tracks review cycles for this domain — see `review-shared/PROCEDURE.md`'s schema section.
