# Session Handoff

_Overwritten each session. Read this FIRST to resume — see AGENTS.md Session protocol._

## Read this before anything else

1. Run `bash init.sh` — fast build-verify gate (install + typecheck + build, no Docker/DB). Fix
   before proceeding if it fails.
2. Complete the rest of `clean-state-checklist.md`'s **Start clean** section (Docker, migrations,
   `pnpm verify`, `/health`).
3. `sprint-contract.md` must be filled in FRESH for the feature you're about to work, BEFORE
   writing code. `evaluator-rubric.md` must score the finished work PASS/CONDITIONAL AFTER,
   by a **separate subagent** (`Agent` tool, `general-purpose`, NOT `fork` — it must not inherit
   your context). Self-grading skews positive — proven six times now across five sprints.
4. **If the evaluator flags an invariant interpretation as ambiguous, don't resolve it yourself.**
   Surface it to the user with `AskUserQuestion`, then record the resolution in `AGENTS.md` §2
   itself so it's settled for good (see "TENANT-ISOLATION clarified" below).
5. **If an evaluator's non-blocking recommendation is cheap to close, close it same-session** —
   every CONDITIONAL across all 5 Tier 1 sprints was closed this way. None was left outstanding.
6. **If a feature's acceptance criteria aren't actually true yet (not just untested), fix the
   real gap before writing the test around it** (see "mock model became template-aware").
7. **If the acceptance criteria describe frontend-observable behavior, wire the frontend even
   without a listed frontend test path** (see "draft persistence" — verified with a real browser
   page reload, not just API tests).
8. **If your own sprint-contract's verification plan claims a test file covers something, make
   sure it actually does** — the `audit.trail` sprint claimed date-range filtering was tested when
   only the `action` filter was. The evaluator caught it by checking the claim against the file,
   not just running the suite. Cross-check your own claims the same way before calling a sprint done.

## Where things stand

- **Tier 0** (core loop): 15/17 passing, 2 `blocked` on real AWS account access. Independently
  evaluated PASS.
- **Tier 1: COMPLETE — 16/16 passing.** Every item independently evaluated PASS or an accepted
  CONDITIONAL, and every CONDITIONAL was closed same-session before being marked done. No
  outstanding debt.
- **Tier 2: 2/4 passing** — `pioneer.version_diff` done (entirely frontend, hand-rolled LCS diff
  in `apps/web/src/features/note/diff.ts`, `VersionDiff.tsx`, compare dropdowns in
  `EncounterWorkspacePage`). Independently evaluated 7/7 PASS, including the evaluator writing its
  own adversarial test cases against the diff algorithm (not just trusting the existing suite).
  `pioneer.red_flags` also done (`libs/ai/src/red-flags.ts` — 11 deterministic regex patterns, no
  LLM call; `GET /encounters/:id/red-flags`, tenant-scoped; advisory banner in
  `EncounterWorkspacePage`, Generate button never gated on flags). Independently evaluated
  CONDITIONAL — 2 required + 2 non-blocking pattern gaps found, **all 4 fixed same session** (see
  "Known gaps" below for the one thing the evaluator found that was NOT fixed this sprint).
  Per `docs/PRODUCT.md`: Tier 2 is "one or two, done well," not a checklist — remaining items are
  being attempted per an explicit "continue to finish everything" instruction from the user this
  session, not because they're required.
- **TENANT-ISOLATION clarified** (2026-08-17): `AGENTS.md` §2 states a patient's clinical history
  CAN cross providers (continuity of care); direct access to another provider's *encounter
  record* stays 403. Settled.
- **localStorage test-env gotcha**: Node 25's native `localStorage` global shadows jsdom's in
  `apps/web`'s vitest setup. Fixed via polyfill in `apps/web/src/test/setup.ts`. Already fixed.
- **Mock model is template-aware**: `MockModelClient` uses `templateApplied`
  (`libs/ai/src/types.ts`) to incorporate the current template into the Plan. `BedrockModelClient`
  doesn't use this field — mock-only, JSDoc'd.
- **Draft persistence exists**: `drafts` table backs `PUT`/`GET /encounters/:id/draft`.
  `EncounterWorkspacePage` restores on mount, debounce-saves on edit, cleared on real save.
- **Audit trail exists**: every note save and every admin write action (provider create/
  deactivate, template create/update/delete) logs to `audit_logs`, queryable via
  `GET /admin/audit-logs` (admin-only, filterable by actor/action/date-range). Verified no
  password or PHI ever reaches the `metadata` column.
- **Red-flag detection exists**: `detectRedFlags()` in `libs/ai/src/red-flags.ts` is a pure,
  deterministic regex scanner (11 patterns) — fully decoupled from generation, never touches
  `ScribeService`/`MockModelClient`. `GET /encounters/:id/red-flags` is tenant-scoped like every
  other encounter route. Frontend shows an advisory banner; Generate stays clickable regardless.

## Environment (must-know before touching anything)

- **Postgres runs on host port 5433, not 5432.** Port 5432 belongs to an unrelated older
  project's container on this machine (`~/workstation/ai-clinical-scribe`) — don't touch it. Same
  for **port 3000** (a different unrelated long-running process). Ports up through 3012 and
  5174-5177 have been used by prior sessions' smoke tests/evaluator probes and are freed after
  each — check with `lsof -nP -iTCP:<port> -sTCP:LISTEN` and pick an unused one.
- `cp .env.example .env` before running anything locally (git-ignored, `AI_PROVIDER=mock` by
  default — no network calls, fully deterministic).
- **Build libs before running/testing apps**: `pnpm run build:libs` (or `pnpm setup` / `bash
  init.sh` / `pnpm verify`, all already do this). `libs/shared-types` and `libs/ai` `package.json`
  point `main`/`types` at `dist/`, not `src/` — Node 25 chokes on native-ESM resolution of
  extensionless imports otherwise. Rebuild the lib after editing `libs/*/src`.
- `pnpm dev`'s filter pattern must stay quoted (`--filter "./apps/*"`).
- To start Postgres: `docker compose -f infra/docker-compose.yml up -d`, then
  `pnpm --filter api run db:migrate && pnpm --filter api run db:seed && pnpm --filter api run icd10:embed`.
- Full check: `pnpm run verify` — exits 0 as of this session. `pnpm --filter api run test:e2e` runs
  82 tests; `pnpm --filter web run test` runs 30; `pnpm --filter @scribe/ai run test` runs 27.
- Demo logins: `dr.chen@clinic.dev` / `provider-pass-1` (+ 2 more), `admin@clinic.dev` /
  `admin-pass-1`. Dev DB accumulates throwaway `test-<uuid>@example.dev` accounts from e2e runs
  (400+ by now) — harmless, or wipe with `docker compose -f infra/docker-compose.yml down -v` +
  re-seed if it bothers you.

## What exists

- **apps/api** (NestJS, raw `pg` pool — no ORM): auth (JWT+argon2), encounters (patient dedup),
  notes (immutable versioning via `pg_advisory_xact_lock`, deletes the draft on save, logs audit),
  drafts (`PUT`/`GET /encounters/:id/draft`), scribe (SSE-over-POST generation with real
  patient-history + ICD-10 + template backend tool calls), icd10 (pgvector search +
  `GET /icd10/search`), templates (`GET` open to any authenticated user;
  `POST`/`PATCH`/`DELETE /:id` admin-only, each logging audit), admin (`GET /admin/encounters`
  filterable, `GET`/`POST /admin/providers`, `PATCH /admin/providers/:id/deactivate` — both
  logging audit — `GET /admin/audit-logs` filterable by actor/action/date-range).
- **apps/web** (Vite/React, plain CSS): login, encounter list/create, workspace page (transcript
  input → streaming generation → inline edit → ICD-10 search-and-append widget → draft
  autosave/restore → save → version history). No admin frontend (every admin.*/audit.trail
  acceptance test is backend-only, confirmed via contract before building).
- **libs/shared-types**: zod schemas = the single contract, imported by both apps.
- **libs/ai**: `ModelClient`/`EmbeddingClient` interfaces, `MockModelClient` (deterministic, calls
  `patientHistoryTool`/`icd10CandidateTool`, template-aware via `templateApplied`), best-effort
  untested `BedrockModelClient`/`BedrockEmbeddingClient`. `MockEmbeddingClient` is a crude
  hash-bag-of-words cosine approximation — known, accepted limitation, don't "fix" it.
- **infra/**: `docker-compose.yml` (local pg+pgvector, NOT real RDS), `nginx.conf` (written, not
  deployed), `DEPLOY.md` (manual AWS steps, not yet executed).
- **docs/erd.md**: full schema ERD + table-by-table rationale.

## Known gaps / things NOT done

- No real AWS deployment (`infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked — needs a
  human with account access; everything code/config-side is ready in `infra/DEPLOY.md`).
- No Playwright web e2e — only Vitest component tests for the web app.
- No admin frontend UI (backend-only, by design — no acceptance test requires it).
- Tier 2 (pioneer): `writing_style` and `bulk_pdf` unstarted — `version_diff` and `red_flags` are
  now done. Not urgent per product doc; being attempted anyway per explicit user instruction.
- No rate limiting / no CSRF concern beyond JWT bearer auth (SPA + bearer token, no cookies).
- **Cross-cycle transcript-autosave race (found by the `red_flags` evaluator, NOT fixed yet)**:
  in `EncounterWorkspacePage.onTranscriptChange`, under elevated network latency an older
  `updateInput` PATCH can resolve *after* a newer one, leaving RDS with a stale transcript — which
  then also stales the red-flags banner and the Subjective section of the next generated note.
  This is a pre-existing Tier 0/1 bug (this sprint's own fix — awaiting `updateInput` before
  re-scanning flags within one cycle — is correct and doesn't cause it). Needs its own
  sprint-contract before being touched; likely fix shape is a monotonic request-sequence guard
  (ignore a PATCH/GET response if a newer request for the same encounter has already started),
  not a debounce-interval change.

## Next feature to work

Per the user's explicit "continue to finish everything" instruction, proceed to the next Tier 2
pioneer item without stopping to ask first — same sprint-contract-first workflow each time:
1. **`pioneer.writing_style`** — hardest of the two: "adapts to how a specific provider tends to
   phrase notes... based on their history." With `MockModelClient` fully deterministic and
   template-driven (no actual language model), demonstrating genuine adaptation needs a concrete,
   defensible mechanism — e.g. extracting phrasing features (sentence length, common openers,
   terminology preferences) from a provider's saved `note_versions` and feeding them into the mock
   generation as a new context input, analogous to how `templateApplied` already works. Decide
   the exact mechanism in `sprint-contract.md` BEFORE coding — this is the one most likely to
   invite scope-creep or a hand-wavy "fake it" implementation; be concrete and testable.
2. **`pioneer.bulk_pdf`** — needs a new dependency (a PDF-generation library — check what's
   already permitted before adding one; this repo has otherwise stayed dependency-light). Export
   must respect tenant isolation (only the encounters' own provider or admin) and log to
   `audit_logs` like every other data-export-shaped action.

Also worth surfacing to the user once "continue to finish everything" is done: the tracked
autosave race above deserves its own sprint before more Tier 2 work compounds on top of it.

**Before writing any code for either:** overwrite `sprint-contract.md`'s Active sprint section
fresh. **After the code is green:** launch a fresh evaluator subagent (repo path, branch name, an
unused scratch port, explicit instruction to reproduce claims live rather than trust them). **If
it flags anything, even non-blocking, close what's cheap to close same-session** — pattern held
for both `version_diff` (clean PASS, nothing to close) and `red_flags` (CONDITIONAL, both required
fixes + both non-blocking recommendations closed same session).
