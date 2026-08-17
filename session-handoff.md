# Session Handoff

_Overwritten each session. Read this FIRST to resume — see AGENTS.md Session protocol._

## Where things stand

Tier 0 (the airtight core) is **code-complete, fully tested, and manually browser-verified**:
15/17 passing, 2 `blocked` on real AWS account access (not something an agent can do unattended —
see `infra/DEPLOY.md`). Tier 1 hasn't been started yet, though a few pieces already exist as a
side effect of building Tier 0 correctly (see "Tier 1 head start" below).

## Environment (must-know before touching anything)

- **Postgres runs on host port 5433, not 5432.** Port 5432 is occupied by an unrelated older
  project's container on this machine (`~/workstation/ai-clinical-scribe`, last touched 2026-08-11
  — not part of this repo, don't stop it). `infra/docker-compose.yml`, `.env.example`, and
  `apps/api/test/jest-setup.ts` all already point at 5433.
- `cp .env.example .env` before running anything locally (git-ignored, `AI_PROVIDER=mock` by
  default — no network calls, fully deterministic).
- **Build libs before running/testing apps**: `pnpm run build:libs` (or just `pnpm setup` /
  `pnpm verify`, both already do this). `libs/shared-types` and `libs/ai` `package.json` point
  `main`/`types` at `dist/`, not `src/` — this environment's Node (v25) chokes on native-ESM
  resolution of extensionless imports if a workspace package's entry is raw `.ts`. If you edit a
  file under `libs/*/src`, rebuild that lib before the change is visible to `apps/api`/`apps/web`.
- To start Postgres: `docker compose -f infra/docker-compose.yml up -d`, then
  `pnpm --filter api run db:migrate && pnpm --filter api run db:seed && pnpm --filter api run icd10:embed`.
- Full check: `pnpm run verify` (lint+typecheck+test+build, all packages) — exits 0 as of this
  session. `pnpm --filter api run test:e2e` runs the 27 API e2e tests against real Postgres.
- Demo logins (local seed, see `apps/api/src/seed/seed.ts`): `dr.chen@clinic.dev` /
  `provider-pass-1` (+ 2 more providers), `admin@clinic.dev` / `admin-pass-1`.

## What exists

- **apps/api** (NestJS, raw `pg` pool — no ORM): auth (JWT+argon2), encounters, notes (immutable
  versioning via `pg_advisory_xact_lock`), scribe (SSE-over-POST generation), icd10 (pgvector
  cosine search), templates (read-only list endpoint so far), admin (base `@Roles('admin')` gate
  + `/admin/ping` only), audit (`AuditService.log`, called on note save).
- **apps/web** (Vite/React, plain CSS): login, encounter list/create, workspace page (transcript
  input → streaming generation → inline edit → save → version history). No router-level code
  splitting or design system — intentionally minimal but real.
- **libs/shared-types**: zod schemas = the single contract, imported by both apps.
- **libs/ai**: `ModelClient`/`EmbeddingClient` interfaces, `MockModelClient` (default, deterministic,
  tool-calls a real `patientHistoryTool`/`icd10CandidateTool` so context injection is already wired
  end-to-end even though `context.history_injection`'s dedicated test doesn't exist yet), and a
  best-effort `BedrockModelClient`/`BedrockEmbeddingClient` (untested — no AWS creds here).
- **infra/**: `docker-compose.yml` (local pg+pgvector, NOT real RDS), `nginx.conf` (TLS + SSE
  no-buffering, written but not deployed), `DEPLOY.md` (manual AWS steps, not yet executed).
- **docs/erd.md**: full schema ERD + table-by-table rationale.

## Tier 1 head start (don't re-derive from scratch)

- `PatientsRepository.findOrCreate` (in `encounters.service.ts`'s `create()`) already dedupes
  patients by (first, last, dob) — `patient.match`'s core acceptance criterion. Just needs its own
  test file at `apps/api/test/patient-match.e2e-spec.ts`.
- `ScribeService.generate()` already builds a real `patientHistoryTool` that queries prior
  encounters/notes for the same patient and is passed to the model client — `MockModelClient`
  already calls it and changes the Plan text when history exists (see
  `libs/ai/src/mock-provider.ts` test "plan references prior visit..."). `context.history_injection`
  and `context.behavior_differs` mostly need dedicated e2e coverage proving this via the API, not
  new implementation.
- `TemplatesController` (GET only) and `AdminController` (`@Roles('admin')` gate + `/admin/ping`)
  exist — `admin.templates_crud`/`admin.roster` need POST/PATCH/DELETE routes added to those, not
  new modules.
- `AuditService.log()` already writes rows on note save — `audit.trail` needs it called from admin
  actions too, plus a query endpoint (`AuditService.listAll()` exists but isn't exposed via a
  controller yet).

## Known gaps / things NOT done

- No real AWS deployment (see above — `infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked).
- No Playwright web e2e (`apps/web`'s `test:e2e` script is a no-op placeholder) — only Vitest
  component tests exist for the web app so far.
- `session.draft_persist`/`session.cross_device`: the `drafts` table exists in the schema but
  nothing reads/writes it yet — currently the encounter's own `transcript` column is what
  autosaves (debounced PATCH from `EncounterWorkspacePage`), which happens to give draft-persist-ish
  behavior for the transcript but not the in-progress *generated* note.
- No rate limiting / no CSRF concern beyond JWT bearer auth (SPA + bearer token, no cookies).

## Next feature to work

Pick up at Tier 1, top-down per `feature-list.json`: `patient.match` first (cheapest — mostly
already implemented, just needs its test).
