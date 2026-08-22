---
name: review-web
description: Review, fix, and prep for merge any pending apps/web work — runs /code-review plus a frontend-specific harness-compliance pass, then stops for human merge approval. Use when there's new/unreviewed frontend work, or the user asks to review web/frontend changes.
---

Domain config for the shared procedure in `.claude/skills/review-shared/PROCEDURE.md` — read that
first, this file only names the scope and domain-specific checks.

**Scope note:** like `devops-request-grant`, this skill's own operational state (`init.sh`, `feature-list.json`, `session-handoff.md`, `progress.md`, `graph.md`) lives only under `.claude/skills/review-web/` — Claude Code specific, on purpose (its dispatch mechanics have no direct equivalent in every agent tool). `review-shared/PROCEDURE.md` is the authoritative procedure; this file and its state are one tool's implementation of it.

## Scope

`apps/web/src/**`, and `libs/shared-types/**` where it's consumed by the frontend. Never edit
`apps/api/src/**`, `devops/**`, or `infra/**` as part of a fix here — if a fix genuinely needs a
backend change, flag it and stop rather than crossing the boundary.

## Harness-compliance pass (in addition to `/code-review`)

Check the diff against root `AGENTS.md` §2's invariants as they apply to the frontend:
- **[CONTEXT-INJECTION]** — prior-patient history must never be stuffed into the frontend prompt
  or sent from the client. Any new fetch/request touching encounter/patient data should be
  checked for this.
- **[CLINICAL-SAFETY]** — the AI drafts, the provider reviews/edits before save. No UI path may
  auto-save an AI draft without a human edit/confirm step in between.
- **[STREAMING]** — SSE rendering must be progressive (token-by-token), never spinner-then-dump.
- **[SECRETS]** — no token/secret/PHI logged to the browser console or written to localStorage
  beyond what's already an established pattern.
- General: does the change match this repo's stated "high-trust clinical tool" bar (root
  `AGENTS.md` §1) rather than introducing an inconsistent UI pattern.

## Toolchain (`init.sh` checks)

`git`, `gh`, `node`/`pnpm`, `jq`, `python3`. Runs `pnpm --filter web test` (or the closest
equivalent — check `package.json`) as part of the review if the PR touches test files, but this
skill's own gate doesn't require Docker/Postgres to be up (that's `review-api`'s concern).

## `feature-list.json`

Tracks review cycles for this domain — see `review-shared/PROCEDURE.md`'s schema section. Same
file shape as `devops-request-grant/feature-list.json`, different domain.
