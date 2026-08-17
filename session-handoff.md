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
   your context). Self-grading skews positive — proven five times now (see log below).
4. **If the evaluator flags an invariant interpretation as ambiguous, don't resolve it yourself.**
   Surface it to the user with `AskUserQuestion` and get an explicit call, then record the
   resolution in `AGENTS.md` §2 itself so it's settled for good (see "TENANT-ISOLATION clarified"
   below — the pattern to repeat).
5. **If an evaluator's non-blocking recommendation is cheap to close, close it same-session.**
6. **If a feature's acceptance criteria aren't actually true yet (not just untested), fix the
   real gap before writing the test around it** (see "mock model became template-aware" below).
7. **If the acceptance criteria describe frontend-observable behavior, wire the frontend even
   without a listed frontend test path** — a backend-only implementation can pass its own tests
   while the actual product stays unchanged (see "draft persistence" sprint below, which did a
   real browser walkthrough with a page reload as its own verification step, not just API tests).

## Where things stand

- **Tier 0** (core loop): 15/17 passing, 2 `blocked` on real AWS account access. Independently
  evaluated PASS.
- **Tier 1**: 15/16 passing — only `audit.trail` remains. Every passing item independently
  evaluated PASS or accepted CONDITIONAL (all CONDITIONALs closed same-session — see log).
- **TENANT-ISOLATION clarified** (2026-08-17): `AGENTS.md` §2 now explicitly states a patient's
  clinical history CAN cross providers (continuity of care); direct access to another provider's
  *encounter record* stays 403. Settled — don't re-raise it.
- **localStorage test-env gotcha** (2026-08-17): Node 25's experimental native `localStorage`
  global shadows jsdom's in `apps/web`'s vitest setup. Fixed with an in-memory `Storage` polyfill
  in `apps/web/src/test/setup.ts`. Already fixed — look elsewhere if you see this error.
- **Mock model became template-aware** (2026-08-17): `MockModelClient` now uses `templateApplied`
  (`libs/ai/src/types.ts`) to visibly incorporate the current template into the Plan.
  `BedrockModelClient` doesn't use this field — mock-only, documented via JSDoc.
- **Draft persistence exists** (2026-08-17): `drafts` table (unused since Tier 0) now backs
  `PUT`/`GET /encounters/:id/draft`. `EncounterWorkspacePage` restores on mount and debounce-saves
  on every note edit (guarded against firing mid-SSE-stream). `NotesService.save()` deletes the
  draft after a real save. Verified live: an unsaved edit survived an actual page navigation.
- **Tier 2**: 0/4, not started, not a priority per `docs/PRODUCT.md`.

## Environment (must-know before touching anything)

- **Postgres runs on host port 5433, not 5432.** Port 5432 belongs to an unrelated older
  project's container on this machine (`~/workstation/ai-clinical-scribe`) — don't touch it. Same
  for **port 3000** (a different unrelated long-running process). Ports up through 3010 and
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
  69 tests; `pnpm --filter web run test` runs 21; `pnpm --filter @scribe/ai run test` runs 13.
- Demo logins: `dr.chen@clinic.dev` / `provider-pass-1` (+ 2 more), `admin@clinic.dev` /
  `admin-pass-1`. Dev DB accumulates throwaway `test-<uuid>@example.dev` accounts from e2e runs
  (400+ by now) — harmless, or wipe with `docker compose -f infra/docker-compose.yml down -v` +
  re-seed if it bothers you.

## What exists

- **apps/api** (NestJS, raw `pg` pool — no ORM): auth (JWT+argon2), encounters (patient dedup),
  notes (immutable versioning via `pg_advisory_xact_lock`, deletes the draft on save), drafts
  (`PUT`/`GET /encounters/:id/draft`), scribe (SSE-over-POST generation with real patient-history +
  ICD-10 + template backend tool calls), icd10 (pgvector search + `GET /icd10/search`), templates
  (`GET` open to any authenticated user; `POST`/`PATCH`/`DELETE /:id` admin-only on the same
  controller via per-method `@Roles('admin')`), admin (`GET /admin/encounters` filterable,
  `GET`/`POST /admin/providers`, `PATCH /admin/providers/:id/deactivate`), audit
  (`AuditService.log`, called on note save only — **not yet** called from admin actions, no query
  endpoint — this is `audit.trail`, the one remaining Tier 1 item).
- **apps/web** (Vite/React, plain CSS): login, encounter list/create, workspace page (transcript
  input → streaming generation → inline edit → ICD-10 search-and-append widget → draft
  autosave/restore → save → version history). No admin frontend (every admin.* acceptance test is
  backend-only, confirmed via contract before building).
- **libs/shared-types**: zod schemas = the single contract, imported by both apps.
- **libs/ai**: `ModelClient`/`EmbeddingClient` interfaces, `MockModelClient` (deterministic, calls
  `patientHistoryTool`/`icd10CandidateTool`, template-aware via `templateApplied`), best-effort
  untested `BedrockModelClient`/`BedrockEmbeddingClient`. `MockEmbeddingClient` is a crude
  hash-bag-of-words cosine approximation — known, accepted limitation, don't "fix" it.
- **infra/**: `docker-compose.yml` (local pg+pgvector, NOT real RDS), `nginx.conf` (written, not
  deployed), `DEPLOY.md` (manual AWS steps, not yet executed).
- **docs/erd.md**: full schema ERD + table-by-table rationale.

## The one remaining Tier 1 item: audit.trail

- `AuditService.log()` and `AuditService.listAll()` both already exist
  (`apps/api/src/audit/audit.service.ts`) — `listAll()` isn't exposed via any controller yet.
- Only `NotesService.save()` calls `audit.log()` currently. Acceptance requires admin actions too:
  `AdminService.createProvider`/`deactivateProvider`, `TemplatesController`'s
  create/update/delete routes — none of them log yet.
- Needs: an admin-only query endpoint (likely `GET /admin/audit-logs`, filterable similar to
  `admin.view_all`'s pattern), plus wiring `audit.log()` into the admin write paths above.
- Consider whether tenant isolation applies to audit-log reads (almost certainly admin-only, same
  gate as everything else in `AdminController`).

## Known gaps / things NOT done

- No real AWS deployment (`infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked).
- No Playwright web e2e — only Vitest component tests for the web app.
- `audit.trail`: partial (see above) — the only open Tier 1 item.
- Tier 2 (pioneer features): not started, not a priority per `docs/PRODUCT.md`.
- No rate limiting / no CSRF concern beyond JWT bearer auth (SPA + bearer token, no cookies).

## Next feature to work

`audit.trail` — the last Tier 1 item. After that, Tier 1 is 16/16 and the honest next call is
whether to attempt a Tier 2 "pioneer" feature (per `docs/PRODUCT.md`, only one or two, done well,
are worth it) or return to `infra.rds_postgres_private`/`infra.ec2_nginx_tls` if real AWS access
becomes available.

**Before writing any code:** overwrite `sprint-contract.md`'s Active sprint section. **After the
code is green:** launch a fresh evaluator subagent (repo path, branch name, an unused scratch
port, explicit instruction to reproduce claims live rather than trust them). **If it flags
anything, even non-blocking, close what's cheap to close same-session** before flipping
`feature-list.json`.
