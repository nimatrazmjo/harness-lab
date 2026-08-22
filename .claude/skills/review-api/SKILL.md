---
name: review-api
description: Review, fix, and prep for merge any pending apps/api work — runs /code-review plus a backend-specific harness-compliance pass, then stops for human merge approval. Use when there's new/unreviewed backend work, or the user asks to review API/backend changes.
---

Domain config for the shared procedure in `.claude/skills/review-shared/PROCEDURE.md` — read that
first, this file only names the scope and domain-specific checks.

**Scope note:** like `devops-request-grant`, this skill's own operational state (`init.sh`, `feature-list.json`, `session-handoff.md`, `progress.md`, `graph.md`) lives only under `.claude/skills/review-api/` — Claude Code specific, on purpose (its dispatch mechanics have no direct equivalent in every agent tool). `review-shared/PROCEDURE.md` is the authoritative procedure; this file and its state are one tool's implementation of it.

## Scope

`apps/api/src/**`, `libs/shared-types/**`, `libs/ai/**`. Never edit `apps/web/src/**`,
`devops/**`, or `infra/**` as part of a fix here — if a fix genuinely needs a frontend or infra
change, flag it and stop rather than crossing the boundary.

## Harness-compliance pass (in addition to `/code-review`)

Check the diff against root `AGENTS.md` §2's invariants — the backend is where most of them are
actually enforced:
- **[SECRETS]** — no hardcoded credential/key; secrets load from Secrets Manager/env at runtime.
- **[PERSISTENCE]** — nothing durable moved off RDS Postgres (no SQLite, in-memory store, flat
  file) for encounters/note_versions/patients/providers/templates/audit_logs/drafts/icd10_codes.
- **[TENANT-ISOLATION]** — every provider-facing query scoped to the authenticated `provider_id`;
  no direct GET/PATCH/list access to another provider's encounter record; admin-wide access only
  through an explicit admin guard. Check the clarified scope note in root `AGENTS.md` §2 too —
  patient-scoped clinical history crossing providers is allowed, direct encounter access is not.
- **[VERSION-IMMUTABILITY]** — editing a note INSERTs a new `note_versions` row; never
  UPDATE/DELETE an existing version.
- **[STREAMING]** — SSE endpoints stream progressively, not spinner-then-dump.
- **[POOLING]** — one shared connection pool per process, never a connection per request.
- **[CONTEXT-INJECTION]** — prior-patient history fetched by a backend tool/function call during
  generation, never accepted from the client/frontend prompt.
- **[CLINICAL-SAFETY]** — no fabricated SOAP note or ICD-10 code on insufficient-content input.

## Toolchain (`init.sh` checks)

`git`, `gh`, `node`/`pnpm`, `docker` (local pg+pgvector for e2e tests), `jq`, `python3`.

## `feature-list.json`

Tracks review cycles for this domain — see `review-shared/PROCEDURE.md`'s schema section.
