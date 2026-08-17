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
   your context). Self-grading skews positive — proven twice now (see log below).
4. **If the evaluator flags an invariant interpretation as ambiguous, don't resolve it yourself.**
   Surface it to the user with `AskUserQuestion` and get an explicit call, then record the
   resolution in `AGENTS.md` §2 itself so it's settled for good, not re-litigated next sprint.
   This happened this session (see "TENANT-ISOLATION clarified" below) — it's the pattern to repeat.

## Where things stand

- **Tier 0** (core loop): 15/17 passing, 2 `blocked` on real AWS account access (not something an
  agent can do unattended — see `infra/DEPLOY.md`). Independently evaluated PASS on all 7
  `evaluator-rubric.md` dimensions.
- **Tier 1**: 4/16 passing — `edge.no_clinical_content`, `patient.match`,
  `context.history_injection`, `context.behavior_differs`. The latter three were a **test-writing
  sprint, not a build sprint**: the plumbing (`PatientsRepository.findOrCreate` dedup,
  `ScribeService`'s `patientHistoryTool`) already existed from Tier 0; this sprint added
  `apps/api/test/{patient-match,context-behavior,context-injection}.e2e-spec.ts` (7 tests, all
  passed first try) to actually prove it.
- **TENANT-ISOLATION clarified** (2026-08-17): the independent evaluator flagged that
  `patientHistoryTool` shares a patient's prior clinical notes across *different* providers (not
  just within one provider's own encounters) as an unresolved interpretation of a "non-negotiable"
  invariant. Surfaced to the user directly — confirmed intended (mirrors real EHR continuity of
  care) — and now written into `AGENTS.md` §2 TENANT-ISOLATION as a permanent clarification. Don't
  re-raise this; it's settled.
- **Tier 2**: 0/4, not started, not a priority per `docs/PRODUCT.md`.

## Environment (must-know before touching anything)

- **Postgres runs on host port 5433, not 5432.** Port 5432 is occupied by an unrelated older
  project's container on this machine (`~/workstation/ai-clinical-scribe`, last touched 2026-08-11
  — not part of this repo, don't stop it). Same goes for **port 3000** — an unrelated 9+ day-old
  process (`node dist/app.js`, different project) squats there; use a scratch port (3002+) for any
  manual `node dist/main.js` runs or adversarial curl testing.
- `cp .env.example .env` before running anything locally (git-ignored, `AI_PROVIDER=mock` by
  default — no network calls, fully deterministic).
- **Build libs before running/testing apps**: `pnpm run build:libs` (or `pnpm setup` / `bash
  init.sh` / `pnpm verify`, all already do this). `libs/shared-types` and `libs/ai` `package.json`
  point `main`/`types` at `dist/`, not `src/` — this environment's Node (v25) chokes on native-ESM
  resolution of extensionless imports if a workspace package's entry is raw `.ts`. Rebuild the lib
  after editing `libs/*/src` before the change is visible to `apps/api`/`apps/web`.
- `pnpm dev`'s filter pattern must stay quoted (`--filter "./apps/*"`) — unquoted, zsh/bash glob-
  expands it before pnpm sees it and breaks the multi-package run. Already fixed, just don't
  "simplify" it back.
- To start Postgres: `docker compose -f infra/docker-compose.yml up -d`, then
  `pnpm --filter api run db:migrate && pnpm --filter api run db:seed && pnpm --filter api run icd10:embed`.
- Full check: `pnpm run verify` — exits 0 as of this session. `pnpm --filter api run test:e2e` runs
  36 tests against real Postgres.
- Demo logins (local seed, see `apps/api/src/seed/seed.ts`): `dr.chen@clinic.dev` /
  `provider-pass-1` (+ 2 more providers), `admin@clinic.dev` / `admin-pass-1`. Dev DB also
  accumulates ~200 `test-<uuid>@example.dev` throwaway accounts from e2e runs — harmless, ignore
  them, or wipe with `docker compose -f infra/docker-compose.yml down -v` + re-seed if it bothers you.

## What exists

- **apps/api** (NestJS, raw `pg` pool — no ORM): auth (JWT+argon2), encounters (patient dedup by
  first+last+dob), notes (immutable versioning via `pg_advisory_xact_lock`), scribe (SSE-over-POST
  generation with real patient-history + ICD-10 backend tool calls), icd10 (pgvector cosine
  search), templates (read-only list endpoint so far), admin (base `@Roles('admin')` gate +
  `/admin/ping` only), audit (`AuditService.log`, called on note save).
- **apps/web** (Vite/React, plain CSS): login, encounter list/create, workspace page (transcript
  input → streaming generation → inline edit → save → version history).
- **libs/shared-types**: zod schemas = the single contract, imported by both apps.
- **libs/ai**: `ModelClient`/`EmbeddingClient` interfaces, `MockModelClient` (default, deterministic,
  genuinely calls `patientHistoryTool`/`icd10CandidateTool`), best-effort untested
  `BedrockModelClient`/`BedrockEmbeddingClient`.
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
- `GET /icd10/search` (backend) already works and is tested at the service level
  (`icd10-assessment.e2e-spec.ts` exercises it indirectly) — `icd10.search_widget` just needs a
  frontend component + `icd10.append_assessment` needs it wired into `NoteEditor`.
- `drafts` table exists in the schema, nothing reads/writes it — `session.draft_persist` is real
  net-new work, not a test-writing sprint like the last one.

## Known gaps / things NOT done

- No real AWS deployment (`infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked — needs a
  human with account access).
- No Playwright web e2e (`apps/web`'s `test:e2e` script is a no-op placeholder) — only Vitest
  component tests exist for the web app so far.
- `session.draft_persist`/`session.cross_device`: not implemented (see above).
- No rate limiting / no CSRF concern beyond JWT bearer auth (SPA + bearer token, no cookies).

## Next feature to work

Pick up at Tier 1, top-down per `feature-list.json`: `icd10.vector_search` is arguably already
covered by existing tests (check before assuming it needs work) — `icd10.search_widget` is the
real next build (frontend component, backend already exists). Alternative: start the `admin.*`
cluster (roster + templates CRUD + view-all) since the base gate already exists.

**Before writing any code:** overwrite `sprint-contract.md`'s Active sprint section. **After the
code is green:** launch a fresh evaluator subagent — see this session's evaluator prompts (two of
them now, both in git history via commit messages / this file's prior versions) for the template:
repo path, branch name, port conventions (5433 Postgres, avoid 3000/3002/3003/3004 if reused,
pick a fresh scratch port), explicit instruction to reproduce claims live rather than trust them.
