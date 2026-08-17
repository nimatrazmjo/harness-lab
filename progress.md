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

- **Active phase:** **Tier 1 is complete (16/16).** Tier 0 core loop + all 5 Tier 1 sprints
  code-complete, verified, and independently evaluated PASS.
- **Tier 0:** 15 / 17 passing (2 `blocked` — real AWS provisioning, see below)   ·   **Tier 1:** 16 / 16 passing   ·   **Tier 2:** 0 / 4 passing
- **Harness:** `clean-state-checklist.md` (Start/Leave-clean gates), `sprint-contract.md`
  (done-conditions agreed before coding), `evaluator-rubric.md` (adversarial score after coding,
  ideally by a fresh subagent) are part of the session protocol — see AGENTS.md §1/§5/§11.
- **Next feature:** no more Tier 1 work. Options: a Tier 2 "pioneer" feature (per
  `docs/PRODUCT.md`, pick one or two, done well — version diff view is the cheapest given
  immutable versions already exist), or return to `infra.rds_postgres_private`/
  `infra.ec2_nginx_tls` if real AWS access ever becomes available.
- **Environment:** local bootstrap via `pnpm setup` (`tools/init.sh` → docker-compose Postgres+pgvector on host port **5433** — 5432 is occupied by an unrelated older project on this machine, `~/workstation/ai-clinical-scribe`, don't touch it). `AI_PROVIDER=mock` by default (deterministic, no network calls) — real Bedrock wiring exists in `libs/ai/src/bedrock-provider.ts` but is untested (no AWS creds in this environment).
- **Open decisions:** none outstanding — raw `pg` + `node-pg-migrate` (not an ORM), zod validation via a custom `ZodValidationPipe`, plain CSS (no UI framework).
- **Blockers:** `infra.rds_postgres_private` and `infra.ec2_nginx_tls` require an actual AWS account/credentials to provision EC2 + RDS — cannot be done by an agent unattended (see `infra/DEPLOY.md`). Everything code/config-side for both (migrations, nginx.conf, IAM notes, TLS verify script) is ready; only the real cloud provisioning step is outstanding.

---

## Log

### 2026-08-17 — audit.trail (PASS) — Tier 1 complete (16/16)
- Last open Tier 1 item. `AuditService.log()`/`listAll()` already existed from Tier 0 (only
  called from `NotesService.save()`) — this sprint wired it into the admin write paths that
  didn't call it yet (`AdminService.createProvider`/`deactivateProvider`,
  `TemplatesController`'s create/update/delete) and exposed `listAll()` via a new
  `GET /admin/audit-logs` (admin-only, filterable by actor/action/date-range, actor name joined
  from `providers` for readability).
- Verified live + via raw psql (not just API response shape) that neither a provider's password
  nor a note's clinical content ever lands in `audit_logs.metadata` — only structural facts
  (email, role, version number, field names changed).
- Independent evaluator: **6/7 PASS, 1/7 CONDITIONAL** (non-blocking, closed same session) — the
  sprint's own verification plan claimed the test file covered all Done conditions, but the
  date-range filter (an explicit Done condition) had no automated test, only `action` did. The
  evaluator verified date-range filtering worked correctly live and flagged the coverage gap
  specifically, not a behavior bug. Added the missing test before closing.
- `pnpm --filter api run test:e2e` now 77/77 (was 69).
- **Tier 1 is now 16/16 — complete.** No more accepted-CONDITIONAL debt outstanding; every
  CONDITIONAL across all 5 Tier 1 sprints was closed same-session before the sprint was marked
  done.
- **Next:** no more Tier 1 work. Tier 2 pioneer feature (see `docs/PRODUCT.md` — one or two, done
  well) or return to the blocked AWS infra items if access becomes available.

---

### 2026-08-17 — session.draft_persist / session.cross_device / edge.session_expired_save (PASS)
- Net-new work (the `drafts` table existed in the schema since Tier 0 but was never read/written).
  `DraftsRepository`/`Service`/`Controller`/`Module` upsert a single mutable row per encounter
  (`UNIQUE(encounter_id)`), `PUT`/`GET /encounters/:id/draft`, gated through the same
  `EncountersService.getForUser` tenant check as everything else encounter-scoped.
  `NotesService.save()` now deletes the draft row after a real save — the work is captured as an
  immutable version, the ephemeral copy is redundant.
- **Frontend wiring was in scope even though no dedicated frontend test path is listed** — the
  acceptance criteria ("the provider resumes exactly where they left off") is inherently
  frontend-observable; a backend-only implementation would pass its own tests while leaving the
  actual product unchanged. `EncounterWorkspacePage` now restores the draft on mount and
  debounce-saves on every note change, guarded against firing mid-SSE-stream.
- Manually verified live in a browser (not just inferred from tests): generated a note, edited
  the Plan with a distinctive marker, did NOT click Save, confirmed the marker landed in Postgres
  via direct SQL, then did an actual page navigation (not a React state check) — the edited note
  reappeared exactly as left. Clicked Save, confirmed the draft row was deleted from Postgres
  afterward.
- `edge.session_expired_save`'s "no data loss" claim is proven without waiting for real 8h JWT
  expiry: a garbage/invalid token on the save attempt gets 401, writes zero `note_versions` rows,
  and leaves the draft (persisted continuously, well before the failed attempt) completely intact
  — a fresh login retrieves the identical draft and completes the save.
- `session.cross_device` proven via two independent logins for the same provider (zero shared
  client state) both seeing the identical draft; caught and fixed a test bug of my own along the
  way — asserting two JWTs from logins in the same second would be *byte-different* is wrong
  (JWTs are deterministic for identical claims+iat), the assertion should be on data identity via
  RDS, not token string comparison.
- Independent evaluator: **7/7 PASS**, no CONDITIONALs, no required fixes — also checked an
  adjacent risk not in the contract (deactivated provider's draft rows stay intact, no
  cascade-delete) and confirmed it holds.
- `pnpm --filter api run test:e2e` now 69/69 (was 60).
- **Next:** `audit.trail` — the last Tier 1 item — write `sprint-contract.md` first.

---

### 2026-08-17 — admin.view_all / admin.roster / admin.templates_crud / admin.template_select / admin.template_live_update (PASS)
- Unlike the two prior Tier 1 sprints, this one required real new backend logic, not just tests:
  `AdminService` (view-all + roster) and admin CRUD routes on `TemplatesController` (mixed with
  its existing public GET via per-method `@Roles('admin')`, not a separate controller).
- **Made a real behavior change**: `MockModelClient` previously received `templateInstructions`
  but never used them — template selection had zero effect on output, so
  `admin.template_select`'s "output visibly differs by template" wasn't actually true yet. Added
  `templateApplied` to `GenerateSoapNoteInput` (`libs/ai/src/types.ts`) so the mock can visibly
  incorporate the *current* template content into the Plan — this is what makes
  `admin.template_select`/`admin.template_live_update` genuinely testable, not a detour.
  `BedrockModelClient` doesn't use this field; a real LLM incorporates template guidance through
  `templateInstructions` (the flattened system-prompt string) via actual language understanding.
- `admin.roster`'s acceptance references an undefined `edge.provider_deactivated` (dangling
  reference to a `docs/PRODUCT.md` edge case that never became a tracked feature). Defined and
  tested it: deactivation never touches a provider's encounter/draft data, and their session ends
  on their very next authenticated request — proved live that an already-issued, unexpired JWT
  gets 401'd on the request immediately after deactivation, not just on a fresh login attempt.
- Added 5 new e2e test files (20 tests) + 3 new `libs/ai` unit tests. Manually verified the full
  roster lifecycle live via curl (create → login → deactivate → 401 on both the old token and a
  fresh login) and confirmed a duplicate-email create returns a clean 409, not a raw Postgres
  stack trace.
- No admin frontend UI built — every acceptance test for this cluster is backend-only per
  `feature-list.json`, confirmed via the contract before coding; evaluator independently confirmed
  zero `apps/web` files touched.
- Independent evaluator: **6/7 PASS, 1/7 CONDITIONAL** (non-blocking) — flagged only that the
  mock's template hack could mislead a future reader who skips the JSDoc into thinking real
  generation works via string concatenation. Already documented, no action needed.
- `pnpm --filter api run test:e2e` now 60/60 (was 40); `pnpm --filter @scribe/ai run test` now
  13/13 (was 10).
- **Next:** `session.draft_persist` or `audit.trail` — write `sprint-contract.md` first.

---

### 2026-08-17 — icd10.vector_search / icd10.search_widget / icd10.append_assessment (PASS)
- Backend search already existed from Tier 0 (`GET /icd10/search`) — added dedicated
  `apps/api/test/icd10-search.e2e-spec.ts` (relevance, limit param, empty-query rejection, auth
  required). Built the frontend net-new: `apps/web/src/api/icd10.ts`, `Icd10SearchWidget.tsx`
  (plain-English input, ranked results, per-result Add button), wired into
  `EncounterWorkspacePage` with client-side dedup (`onAppendIcd10`).
- Manually verified live in a browser: searched "sore throat," got `R07.0 Pain in throat` as a
  ranked result, clicked Add, watched it appear in the note's ICD-10 codes, saved, and confirmed
  via direct SQL that it persisted in `note_versions.icd10_codes`. (Discovered mid-walkthrough
  that a click had missed the Generate button by ~15px, producing a false "insufficient content"
  reading — re-clicked precisely and it worked; not a real bug, just my own imprecise click
  coordinates, confirmed by zooming into the button region before retrying.)
- Independent evaluator: **6/7 PASS, 1/7 CONDITIONAL** (non-blocking) — the widget's two component
  tests (`widget.test.tsx`, `append.test.tsx`) both inject a mocked `search` prop, so
  `icd10Api.search`'s real fetch wiring was unverified by anything automated. Closed same session:
  added `apps/web/src/api/__tests__/icd10.test.ts` (4 tests).
- Writing that test surfaced an unrelated, previously-invisible **test-environment bug**: Node 25's
  experimental native `localStorage` global shadows jsdom's non-functional one in this vitest
  setup — `window.localStorage === globalThis.localStorage` and neither had a working `setItem`.
  Nothing had ever exercised `api/client.ts` or `state/auth-context.tsx` in a test before, so this
  was silently broken and undetected. Fixed with a minimal in-memory `Storage` polyfill in
  `apps/web/src/test/setup.ts`. Web suite: 17 → 21 tests, all green.
- Also confirmed live: the search endpoint safely no-ops a SQL-injection-flavored query string
  (parameterized query), rejects an empty query with 400, and requires auth.
- **Next:** `admin.*` cluster or `session.draft_persist` — write `sprint-contract.md` first.

---

### 2026-08-17 — patient.match / context.history_injection / context.behavior_differs (PASS)
- Wrote `sprint-contract.md` for this cluster first, per the new contract-before-code rule.
  Rationale documented up front: the underlying plumbing (patient dedup in
  `PatientsRepository.findOrCreate`, the `patientHistoryTool` in `ScribeService`) already existed
  as a side effect of Tier 0 — this was a test-writing sprint, not a build sprint.
- Added `apps/api/test/{patient-match,context-behavior,context-injection}.e2e-spec.ts` (7 tests).
  All passed on the first run against real Postgres — confirmed the existing behavior was already
  correct, just unverified at the e2e level. `pnpm --filter api run test:e2e` now 36/36.
- Independent evaluator subagent: **5/7 PASS, 2/7 CONDITIONAL** — both instances of CONDITIONAL
  flagged the same thing: `ScribeService`'s `patientHistoryTool` scopes prior history by
  `patient_id`, not `provider_id`, so Provider B automatically gets Provider A's prior
  assessment/plan for a shared patient. The evaluator confirmed this live and correctly declined
  to rubber-stamp it as fine just because `sprint-contract.md` (written by the same agent) argued
  it was intentional — it flagged that this was an agent's unilateral interpretation of a
  "non-negotiable" invariant with no recorded human sign-off.
- Surfaced the exact tradeoff to the user via `AskUserQuestion` rather than deciding alone. User
  confirmed patient-scoped history sharing is intended (mirrors real EHR continuity of care).
  Recorded as a **clarified invariant in `AGENTS.md` §2 TENANT-ISOLATION** ("Clarified scope"
  paragraph) so this is settled going forward, not an ambiguity anyone has to re-litigate.
- No production code changed this sprint — diff is 3 new test files + doc updates.
- **Next:** `icd10.search_widget` or `admin.*` — write `sprint-contract.md` first.

---

### 2026-08-17 — Harness gates adopted; Tier 0 independently evaluated (PASS)
- User added `clean-state-checklist.md`, `sprint-contract.md`, `evaluator-rubric.md` and updated
  `AGENTS.md`'s session protocol / definition-of-done to require them.
- Ran the Start-clean gate against the existing Tier 0 branch: `pnpm verify` green, `/health` OK
  through the pool, migrations current, no committed secrets — baseline confirmed green before
  any new work.
- Filled `sprint-contract.md` retroactively for the already-completed Tier 0 sprint (it predates
  these files), then launched a **fresh subagent with no authorship context** as the evaluator
  (per the rubric's own instruction to separate evaluator from generator). It re-ran `pnpm verify`
  and the e2e suite itself, probed tenant isolation and the clinical-safety gate with its own curl
  commands against a live instance, and checked `note_versions` directly in Postgres for
  immutability — did not trust any of the generator's claims.
- **Verdict: PASS on all 7 dimensions**, no blocking issues. One non-blocking gap: no HTTP-level
  e2e test for garbage input on the live `/scribe/generate` route (only unit-tested at
  `hasClinicalContent()`). Closed same-session:
  `apps/api/test/edge-no-content.e2e-spec.ts` (2 new tests, both green) — this also genuinely
  satisfies `edge.no_clinical_content` (Tier 1), flipped to `passing`.
- `pnpm --filter api run test:e2e` now 29/29 (was 27/27); `pnpm verify` still exits 0 across all
  4 packages.
- **Next:** pick the next Tier 1 feature, write its `sprint-contract.md` first.

---

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
