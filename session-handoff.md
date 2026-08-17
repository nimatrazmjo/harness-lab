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
   your context). Self-grading skews positive — proven four times now (see log below).
4. **If the evaluator flags an invariant interpretation as ambiguous, don't resolve it yourself.**
   Surface it to the user with `AskUserQuestion` and get an explicit call, then record the
   resolution in `AGENTS.md` §2 itself so it's settled for good (see "TENANT-ISOLATION clarified"
   below — the pattern to repeat).
5. **If an evaluator's non-blocking recommendation is cheap to close, close it same-session**
   rather than deferring — this has twice surfaced a real, previously-invisible bug (see
   "localStorage test-env gotcha" below).
6. **If a feature's acceptance criteria aren't actually true yet (not just untested), fix the
   real gap before writing the test around it.** Happened this session: `admin.template_select`
   required generation output to visibly differ by template, but the mock model silently ignored
   template content entirely — see "mock model became template-aware" below.

## Where things stand

- **Tier 0** (core loop): 15/17 passing, 2 `blocked` on real AWS account access. Independently
  evaluated PASS.
- **Tier 1**: 12/16 passing — everything except `session.draft_persist`, `session.cross_device`,
  `edge.session_expired_save`, `audit.trail`. All 12 independently evaluated PASS or accepted
  CONDITIONAL (every CONDITIONAL closed same-session — see log for specifics per sprint).
- **TENANT-ISOLATION clarified** (2026-08-17): `AGENTS.md` §2 now explicitly states a patient's
  clinical history CAN cross providers (continuity of care); direct access to another provider's
  *encounter record* stays 403. Settled — don't re-raise it.
- **localStorage test-env gotcha** (2026-08-17): Node 25's experimental native `localStorage`
  global shadows jsdom's in `apps/web`'s vitest setup. Fixed with an in-memory `Storage` polyfill
  in `apps/web/src/test/setup.ts`. If you ever see `localStorage.setItem is not a function` in a
  web test, this is already fixed — look elsewhere for the cause.
- **Mock model became template-aware** (2026-08-17): `MockModelClient` previously ignored
  `templateInstructions` entirely — template selection had zero effect on generated output. Added
  `templateApplied` to `GenerateSoapNoteInput` (`libs/ai/src/types.ts`) so the mock visibly
  incorporates the *current* template into the Plan (`[TemplateName] ... Template guidance
  applied: <promptInstructions>`). `BedrockModelClient` doesn't use this field — a real LLM
  incorporates template guidance through actual language understanding of the flattened
  `templateInstructions` string, not string concatenation. This is documented via JSDoc as
  mock-only; don't copy the pattern elsewhere without the same disclaimer.
- **Tier 2**: 0/4, not started, not a priority per `docs/PRODUCT.md`.

## Environment (must-know before touching anything)

- **Postgres runs on host port 5433, not 5432.** Port 5432 is occupied by an unrelated older
  project's container on this machine (`~/workstation/ai-clinical-scribe`, not part of this repo,
  don't touch it). Same goes for **port 3000** — an unrelated long-running process from a
  different project squats there. Ports up through 3008 and 5174-5176 have been used by prior
  sessions' smoke tests / evaluator probes and are freed after each — check with
  `lsof -nP -iTCP:<port> -sTCP:LISTEN` and pick an unused one rather than assuming.
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
  60 tests; `pnpm --filter web run test` runs 21; `pnpm --filter @scribe/ai run test` runs 13.
- Demo logins (local seed): `dr.chen@clinic.dev` / `provider-pass-1` (+ 2 more providers),
  `admin@clinic.dev` / `admin-pass-1`. Dev DB accumulates throwaway `test-<uuid>@example.dev`
  accounts from e2e runs (300+ by now) — harmless, ignore them, or wipe with
  `docker compose -f infra/docker-compose.yml down -v` + re-seed if it bothers you.

## What exists

- **apps/api** (NestJS, raw `pg` pool — no ORM): auth (JWT+argon2), encounters (patient dedup),
  notes (immutable versioning via `pg_advisory_xact_lock`), scribe (SSE-over-POST generation with
  real patient-history + ICD-10 + template backend tool calls), icd10 (pgvector search +
  `GET /icd10/search`), templates (`GET /templates` open to any authenticated user;
  `POST`/`PATCH`/`DELETE /templates/:id` admin-only on the SAME controller via per-method
  `@Roles('admin')`), admin (`GET /admin/encounters` filterable, `GET`/`POST /admin/providers`,
  `PATCH /admin/providers/:id/deactivate`), audit (`AuditService.log`, called on note save only
  — not yet called from admin actions).
- **apps/web** (Vite/React, plain CSS): login, encounter list/create, workspace page (transcript
  input → streaming generation → inline edit → ICD-10 search-and-append widget → save → version
  history). No admin frontend — every admin.* acceptance test is backend-only, confirmed via the
  sprint contract before building, so none was built.
- **libs/shared-types**: zod schemas = the single contract, imported by both apps.
- **libs/ai**: `ModelClient`/`EmbeddingClient` interfaces, `MockModelClient` (default,
  deterministic, calls `patientHistoryTool`/`icd10CandidateTool`, now template-aware via
  `templateApplied`), best-effort untested `BedrockModelClient`/`BedrockEmbeddingClient`.
  `MockEmbeddingClient` is a crude hash-bag-of-words cosine approximation — fine for short,
  vocabulary-overlapping queries, noisy for long transcripts. Known, accepted limitation; don't
  try to "fix" the mock's algorithm.
- **infra/**: `docker-compose.yml` (local pg+pgvector, NOT real RDS), `nginx.conf` (written, not
  deployed), `DEPLOY.md` (manual AWS steps, not yet executed).
- **docs/erd.md**: full schema ERD + table-by-table rationale.

## Tier 1 head start (don't re-derive from scratch)

- `AuditService.log()` already writes rows on note save — `audit.trail` needs it called from admin
  actions too (roster create/deactivate, template CRUD — `AdminService`/`TemplatesController`
  don't call it yet), plus a query endpoint (`AuditService.listAll()` exists but isn't exposed via
  a controller).
- `drafts` table exists in the schema, nothing reads/writes it — `session.draft_persist` is real
  net-new work. Currently the encounter's own `transcript` column autosaves (debounced PATCH from
  `EncounterWorkspacePage`), which gives draft-persist-ish behavior for the transcript only, not
  an in-progress *generated* note.
- `edge.session_expired_save`: no JWT-refresh or draft-recovery flow exists yet for a save attempt
  after token expiry — genuinely unbuilt.

## Known gaps / things NOT done

- No real AWS deployment (`infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked).
- No Playwright web e2e — only Vitest component tests for the web app.
- `session.draft_persist`/`session.cross_device`/`edge.session_expired_save`: not implemented.
- `audit.trail`: partial — note saves are logged, admin actions are not, no query endpoint.
- No rate limiting / no CSRF concern beyond JWT bearer auth (SPA + bearer token, no cookies).

## Next feature to work

Pick up at Tier 1, top-down per `feature-list.json`: `session.draft_persist` (net-new, touches the
unused `drafts` table) or `audit.trail` (partial — extend `AuditService` calls + add a query
endpoint) are the two real remaining chunks; `edge.session_expired_save` and
`session.cross_device` depend on `session.draft_persist` landing first.

**Before writing any code:** overwrite `sprint-contract.md`'s Active sprint section. **After the
code is green:** launch a fresh evaluator subagent (repo path, branch name, an unused scratch
port, explicit instruction to reproduce claims live rather than trust them — see prior sprints'
evaluator prompts in git history, `git log --all --grep="Adversarial evaluator"` won't work since
those are Task tool prompts not commits, but each sprint's evaluator-rubric.md commit references
what was asked). **If it flags anything, even non-blocking, close what's cheap to close
same-session** before flipping `feature-list.json`.
