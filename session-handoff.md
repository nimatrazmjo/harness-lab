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
   your context). Self-grading skews positive — proven three times now (see log below).
4. **If the evaluator flags an invariant interpretation as ambiguous, don't resolve it yourself.**
   Surface it to the user with `AskUserQuestion` and get an explicit call, then record the
   resolution in `AGENTS.md` §2 itself so it's settled for good (see "TENANT-ISOLATION clarified"
   below — the pattern to repeat).
5. **If an evaluator's non-blocking recommendation is cheap to close, close it same-session**
   rather than deferring — this has twice surfaced a real, previously-invisible bug (see
   "localStorage test-env gotcha" below) that would otherwise have stayed hidden.

## Where things stand

- **Tier 0** (core loop): 15/17 passing, 2 `blocked` on real AWS account access (not something an
  agent can do unattended — see `infra/DEPLOY.md`). Independently evaluated PASS.
- **Tier 1**: 7/16 passing — `edge.no_clinical_content`, `patient.match`,
  `context.history_injection`, `context.behavior_differs`, `icd10.vector_search`,
  `icd10.search_widget`, `icd10.append_assessment`. All independently evaluated PASS (patient-
  context sprint had 2 CONDITIONAL dimensions resolved via human sign-off; icd10 sprint had 1
  CONDITIONAL resolved by closing a test-coverage gap same session).
- **TENANT-ISOLATION clarified** (2026-08-17): `AGENTS.md` §2 now explicitly states that a
  patient's clinical history CAN cross providers (continuity of care), while direct access to
  another provider's *encounter record* stays 403. Settled — don't re-raise it.
- **localStorage test-env gotcha** (2026-08-17): Node 25's experimental native `localStorage`
  global shadows jsdom's in `apps/web`'s vitest setup — `window.localStorage ===
  globalThis.localStorage` and neither had a working `setItem` before this was caught. Fixed with
  an in-memory `Storage` polyfill in `apps/web/src/test/setup.ts`. Any web test touching
  `api/client.ts` or `state/auth-context.tsx` (directly or via a component that calls them) now
  works; before this fix, NOTHING had ever exercised that path in a test, silently.
- **Tier 2**: 0/4, not started, not a priority per `docs/PRODUCT.md`.

## Environment (must-know before touching anything)

- **Postgres runs on host port 5433, not 5432.** Port 5432 is occupied by an unrelated older
  project's container on this machine (`~/workstation/ai-clinical-scribe`, last touched 2026-08-11
  — not part of this repo, don't stop it). Same goes for **port 3000** — an unrelated 9+ day-old
  process (`node dist/app.js`, different project) squats there. Ports 3002-3006 and 5174-5176 have
  all been used by prior sessions' manual smoke tests / evaluator probes and are freed after each
  — pick a fresh unused port (check with `lsof -nP -iTCP:<port> -sTCP:LISTEN` first) rather than
  assuming.
- `cp .env.example .env` before running anything locally (git-ignored, `AI_PROVIDER=mock` by
  default — no network calls, fully deterministic).
- **Build libs before running/testing apps**: `pnpm run build:libs` (or `pnpm setup` / `bash
  init.sh` / `pnpm verify`, all already do this). `libs/shared-types` and `libs/ai` `package.json`
  point `main`/`types` at `dist/`, not `src/` — Node 25 chokes on native-ESM resolution of
  extensionless imports if a workspace package's entry is raw `.ts`. Rebuild the lib after editing
  `libs/*/src` before the change is visible to `apps/api`/`apps/web`.
- `pnpm dev`'s filter pattern must stay quoted (`--filter "./apps/*"`) — unquoted, zsh/bash glob-
  expands it before pnpm sees it and breaks the multi-package run.
- To start Postgres: `docker compose -f infra/docker-compose.yml up -d`, then
  `pnpm --filter api run db:migrate && pnpm --filter api run db:seed && pnpm --filter api run icd10:embed`.
- Full check: `pnpm run verify` — exits 0 as of this session. `pnpm --filter api run test:e2e` runs
  40 tests; `pnpm --filter web run test` runs 21 — both against real Postgres/real components.
- Demo logins (local seed, see `apps/api/src/seed/seed.ts`): `dr.chen@clinic.dev` /
  `provider-pass-1` (+ 2 more providers), `admin@clinic.dev` / `admin-pass-1`. Dev DB also
  accumulates ~200 `test-<uuid>@example.dev` throwaway accounts from e2e runs — harmless, ignore
  them, or wipe with `docker compose -f infra/docker-compose.yml down -v` + re-seed if it bothers you.

## What exists

- **apps/api** (NestJS, raw `pg` pool — no ORM): auth (JWT+argon2), encounters (patient dedup by
  first+last+dob), notes (immutable versioning via `pg_advisory_xact_lock`), scribe (SSE-over-POST
  generation with real patient-history + ICD-10 backend tool calls), icd10 (pgvector cosine
  search + `GET /icd10/search`), templates (read-only list endpoint so far), admin (base
  `@Roles('admin')` gate + `/admin/ping` only), audit (`AuditService.log`, called on note save).
- **apps/web** (Vite/React, plain CSS): login, encounter list/create, workspace page (transcript
  input → streaming generation → inline edit → **ICD-10 search-and-append widget** → save →
  version history).
- **libs/shared-types**: zod schemas = the single contract, imported by both apps.
- **libs/ai**: `ModelClient`/`EmbeddingClient` interfaces, `MockModelClient` (default, deterministic,
  genuinely calls `patientHistoryTool`/`icd10CandidateTool`), best-effort untested
  `BedrockModelClient`/`BedrockEmbeddingClient`. `MockEmbeddingClient` is a crude hash-bag-of-words
  cosine approximation — fine for short, vocabulary-overlapping queries (e.g. "sore throat" ->
  `R07.0`), noisy for long transcripts with little exact word overlap against the seeded
  descriptions. Known, accepted limitation of the mock; a real Bedrock embedding model would not
  have this problem. Don't try to "fix" the mock's algorithm — that's solving the wrong layer.
- **infra/**: `docker-compose.yml` (local pg+pgvector, NOT real RDS), `nginx.conf` (written, not
  deployed), `DEPLOY.md` (manual AWS steps, not yet executed).
- **docs/erd.md**: full schema ERD + table-by-table rationale.

## Tier 1 head start (don't re-derive from scratch)

- `TemplatesController` (GET only) and `AdminController` (`@Roles('admin')` gate + `/admin/ping`)
  exist — `admin.templates_crud`/`admin.roster`/`admin.view_all` need POST/PATCH/DELETE/filtered-
  list routes added to those, not new modules.
- `AuditService.log()` already writes rows on note save — `audit.trail` needs it called from admin
  actions too, plus a query endpoint (`AuditService.listAll()` exists but isn't exposed via a
  controller yet).
- `drafts` table exists in the schema, nothing reads/writes it — `session.draft_persist` is real
  net-new work, not a test-writing sprint.

## Known gaps / things NOT done

- No real AWS deployment (`infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked — needs a
  human with account access).
- No Playwright web e2e (`apps/web`'s `test:e2e` script is a no-op placeholder) — only Vitest
  component tests exist for the web app so far.
- `session.draft_persist`/`session.cross_device`: not implemented.
- No rate limiting / no CSRF concern beyond JWT bearer auth (SPA + bearer token, no cookies).

## Next feature to work

Pick up at Tier 1, top-down per `feature-list.json`: the `admin.*` cluster (`admin.view_all`,
`admin.roster`, `admin.templates_crud`, `admin.template_select`, `admin.template_live_update`) —
base gate exists, this is real CRUD build work, biggest remaining Tier 1 chunk. Alternative:
`session.draft_persist` (also net-new, smaller).

**Before writing any code:** overwrite `sprint-contract.md`'s Active sprint section. **After the
code is green:** launch a fresh evaluator subagent (repo path, branch name, an unused scratch
port, explicit instruction to reproduce claims live rather than trust them — see prior sprints'
evaluator prompts in git history for the template). **If it flags anything, even non-blocking,
close what's cheap to close same-session** before flipping `feature-list.json`.
