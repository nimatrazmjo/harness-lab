# Progress Log — AI Clinical Scribe

Rolling log the agent reads at the **start** of every session and updates at the **end**. It is
the fast way to recover context without re-exploring the repo. Newest entry on top.

> **How to maintain (agent):**
> - **Session start:** read "Current state" below, then the latest 2–3 log entries.
> - **After each feature / session end:** update "Current state" and prepend a dated entry.
> - Reference features by their `feature-list.json` id. Keep entries short: what changed, what's next.
> - Division of labor: `progress.md` = *where we are*; `feature-list.json` = *what's left*;
>   `docs/` = *what & why + how*.

---

## Current state

- **Active phase:** Tier 0 core loop is code-complete and verified. Ready to start Tier 1.
- **Tier 0:** 15 / 17 passing (2 `blocked` — real AWS provisioning, see below)   ·   **Tier 1:** 0 / 16 passing   ·   **Tier 2:** 0 / 4 passing
- **Next feature:** first Tier 1 item, e.g. `patient.match` (mostly already true via `PatientsRepository.findOrCreate` dedup — write the dedicated test) or `icd10.search_widget`.
- **Environment:** local bootstrap via `pnpm setup` (`tools/init.sh` → docker-compose Postgres+pgvector on host port **5433** — 5432 is occupied by an unrelated older project on this machine, `~/workstation/ai-clinical-scribe`, don't touch it). `AI_PROVIDER=mock` by default (deterministic, no network calls) — real Bedrock wiring exists in `libs/ai/src/bedrock-provider.ts` but is untested (no AWS creds in this environment).
- **Open decisions:** none outstanding — raw `pg` + `node-pg-migrate` (not an ORM), zod validation via a custom `ZodValidationPipe`, plain CSS (no UI framework).
- **Blockers:** `infra.rds_postgres_private` and `infra.ec2_nginx_tls` require an actual AWS account/credentials to provision EC2 + RDS — cannot be done by an agent unattended (see `infra/DEPLOY.md`). Everything code/config-side for both (migrations, nginx.conf, IAM notes, TLS verify script) is ready; only the real cloud provisioning step is outstanding.

---

## Log

### 2026-08-17 — Tier 0 core loop built, tested, and browser-verified
- Built the full monorepo from the harness scaffold: `apps/api` (NestJS, raw `pg` pool, JWT auth,
  argon2), `apps/web` (Vite/React), `libs/shared-types` (zod contracts), `libs/ai` (model-client
  interface + mock provider + best-effort Bedrock provider).
- Schema + migrations (`apps/api/migrations`, `docs/erd.md`) for all 8 tables incl. pgvector HNSW
  index on `icd10_codes`. 234 real ICD-10 codes seeded (`apps/api/src/seed/icd10-data.ts`).
- Implemented and tested (27 API e2e + 10 `libs/ai` unit + 7 API unit + 10 web component tests,
  all green): login/JWT/roles, tenant isolation (403 cross-provider, admin bypass), encounter
  create/input, SSE-over-POST streaming generation (multiple chunks proven over time), structured
  SOAP output, real (non-fabricated) ICD-10 matching via pgvector cosine search, inline edit,
  save → immutable `note_versions` INSERT-only versioning (incl. concurrent-save race test via
  `pg_advisory_xact_lock`), full version history.
- `pnpm verify` (lint + typecheck + test + build, all packages) exits 0.
- Manually smoke-tested the full loop in a real browser (Chrome via MCP) against the running API +
  local Postgres: login → create encounter → paste transcript → watched the SOAP note stream in
  progressively → real ICD-10 codes attached (e.g. M25.561, S83.401A for a knee-injury transcript)
  → edited the Plan section → saved → reloaded the page → version history showed v1 with author +
  timestamp, byte-for-byte as saved.
- **Gotcha:** `libs/*` `package.json` `main`/`types` must point at `dist/`, not `src/index.ts` —
  Node's native TS handling (this environment runs Node 25) chokes on extensionless ESM imports
  when a workspace package's entry point is a raw `.ts` file. Added `build:libs` as a prerequisite
  step in `verify`/`dev`/`tools/init.sh`.
- **Gotcha:** NestJS `@UsePipes()` at the method level applies to *every* parameter, not just
  `@Body()` — it was validating `@CurrentUser()` against the body schema and failing every request
  with 2+ params. Fixed by attaching `ZodValidationPipe` directly to `@Body()` instead.
- Did **not** provision real AWS (EC2/RDS) — no account access in this environment; see
  `infra/DEPLOY.md` for the exact manual steps once that access exists.
- **Next:** Tier 1 — `patient.match` (dedicated test for existing `PatientsRepository.findOrCreate`
  dedup), `context.history_injection` (the tool-call wiring already exists in
  `apps/api/src/scribe/scribe.service.ts`, needs its dedicated behavior-differs test),
  `icd10.search_widget`, `admin.roster`/`admin.templates_crud` (the `AdminController`/
  `TemplatesController` base already exists), `session.draft_persist`, `audit.trail` (the
  `AuditService` already logs `note.save`, needs a query surface + more action coverage).

---

<!-- Template — prepend a new entry under ## Log:
### YYYY-MM-DD — <short title>
- <what changed — reference feature ids, e.g. auth.login now passing>
- <decisions or gotchas worth remembering>
- **Next:** <the next failing feature>
-->
