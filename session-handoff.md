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
- **Tier 2: COMPLETE — 4/4 passing.** `pioneer.version_diff` done (entirely frontend, hand-rolled
  LCS diff in `apps/web/src/features/note/diff.ts`, `VersionDiff.tsx`, compare dropdowns in
  `EncounterWorkspacePage`). Independently evaluated 7/7 PASS, including the evaluator writing its
  own adversarial test cases against the diff algorithm (not just trusting the existing suite).
  `pioneer.red_flags` done (`libs/ai/src/red-flags.ts` — 11 deterministic regex patterns, no LLM
  call; `GET /encounters/:id/red-flags`, tenant-scoped; advisory banner in
  `EncounterWorkspacePage`, Generate button never gated on flags). Independently evaluated
  CONDITIONAL — 2 required + 2 non-blocking pattern gaps found, **all 4 fixed same session** (see
  "Known gaps" below for the one thing the evaluator found that was NOT fixed this sprint).
  `pioneer.writing_style` done (`libs/ai/src/writing-style.ts` — `inferWritingStyle`, a
  deterministic "patient"→"pt" abbreviation-preference detector learned from a provider's own
  saved `note_versions`; applied server-side in `MockModelClient` via `applyWritingStyle`).
  Independently evaluated CONDITIONAL — no required fixes (mechanism was correct pre-pass), 2
  non-blocking recommendations, **both closed same session**.
  `pioneer.bulk_pdf` done (`GET /patients/:patientId/export` — `pdfkit`-rendered, tenant-scoped
  like every other encounter route, audit-logged). Independently evaluated CONDITIONAL — 2
  required fixes (a non-Latin-1 patient name crashed the export; an audit-ordering concern that
  was investigated, found to be an unfixable race if taken literally, and resolved by documenting
  the audit-at-generation-success semantic instead), **both closed same session**, plus all 3
  non-blocking recommendations.
  Per `docs/PRODUCT.md`: Tier 2 was only ever "one or two, done well," not a checklist — all four
  were completed anyway per an explicit "continue to finish everything" instruction from the user
  this session.
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
- **Writing-style learning exists**: `inferWritingStyle()` in `libs/ai/src/writing-style.ts`
  scans a provider's own last 10 saved `note_versions` (`NotesRepository.getRecentByAuthor`,
  `author_id`-scoped) for a real, repeated "patient"→"pt" abbreviation preference (threshold:
  `ptCount >= patientCount + 2 AND ptCount >= 3`). `ScribeService.generate` computes this fresh
  every call and passes it as `writingStyle` on `GenerateSoapNoteInput`, same pattern as
  `templateApplied`. `MockModelClient.applyWritingStyle` does a one-directional, word-boundary-safe
  substitution ("Patient"/"patient" → "Pt"/"pt") across all four SOAP sections — no-op unless the
  profile says "pt", so a provider with no/thin history sees byte-identical output to before this
  feature existed. No frontend surface (not required by acceptance).
- **Bulk PDF export exists**: `GET /patients/:patientId/export` (new `PatientsController`/
  `PatientsService`/`PdfExportService` in `apps/api/src/patients/`) renders every encounter a
  requesting provider owns for a patient (or every provider's, for an admin) as one PDF via
  `pdfkit`. Tenant-isolation selection (`selectEncountersForExport`) is a pure function, unit-
  tested separately from rendering. 403 (not 404) if the patient exists but the requester owns
  none of their encounters. Audits once per export (`patient.bulk_pdf_export`, `metadata:
  {encounterCount}`, no PHI) — logged right after `pdfExport.render()` succeeds, deliberately NOT
  after `res.send()` (that reorder was tried and found to be a genuine unfixable race — see
  `patients.service.ts`'s comment). Filenames are ASCII-sanitized (`safeFilenameSegment` in
  `patients.controller.ts`) so a non-Latin-1 patient name can't crash the response — the PDF body
  text itself still shows the real name correctly.

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
  96 tests; `pnpm --filter web run test` runs 30; `pnpm --filter @scribe/ai run test` runs 33.
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
- **pdfkit** (`apps/api` dependency, added this session): MIT-licensed, pure-JS PDF rendering, no
  native/headless-browser dependency — used only by `PdfExportService`. Not used anywhere else.
- **docs/erd.md**: full schema ERD + table-by-table rationale.

## Known gaps / things NOT done

- No real AWS deployment (`infra.rds_postgres_private`, `infra.ec2_nginx_tls` blocked — needs a
  human with account access; everything code/config-side is ready in `infra/DEPLOY.md`).
- No Playwright web e2e — only Vitest component tests for the web app.
- No admin frontend UI (backend-only, by design — no acceptance test requires it).
- Tier 2 (pioneer) is fully complete — all four items (`version_diff`, `red_flags`,
  `writing_style`, `bulk_pdf`) done. Nothing left in this tier.
- `pioneer.writing_style`'s style window can go "sticky" for long-lived provider accounts (an
  older majority of saved notes can dilute a real, recent preference shift) — a conscious,
  undecided product question flagged by the evaluator, not a bug. Worth a decision if this ever
  becomes real product scope beyond the mock model.
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

**Nothing is required.** Tier 0 (15/17, 2 blocked on real AWS access), Tier 1 (16/16), and Tier 2
(4/4) are all complete — every non-blocked item in `feature-list.json` is `passing`. The "continue
to finish everything" instruction that drove this session's Tier 2 work is now fully satisfied.

What's left, in priority order if the user wants to keep going:
1. **The tracked cross-cycle autosave race** (see "Known gaps" above, found by the `red_flags`
   evaluator two sprints ago, still untouched) — a real, confirmed bug in core Tier 0/1 save-path
   logic (`EncounterWorkspacePage`'s transcript-autosave debounce), not Tier 2 scope. This is the
   most concrete, well-understood next unit of work if the user wants a bug fixed rather than a
   new feature. Needs its own `sprint-contract.md` since it touches core generation-input
   correctness, not a pioneer add-on.
2. **`infra.rds_postgres_private` / `infra.ec2_nginx_tls`** — the only remaining `blocked` items.
   Everything code/config-side is ready (`infra/DEPLOY.md`, `nginx.conf`, migrations); only real
   AWS account provisioning is outstanding, which requires the user to provide credentials/access.
3. Nothing else in `feature-list.json` is `failing` — a fresh session should not invent new scope
   without the user asking for it first (see AGENTS.md §5: "Prioritization is graded — an
   incomplete build that feels finished beats a complete build with sloppy infra," and Tier 2 was
   already explicitly optional per `docs/PRODUCT.md`).

**If picking up (1) or anything new:** overwrite `sprint-contract.md`'s Active sprint section
fresh before writing code. **After the code is green:** launch a fresh evaluator subagent (repo
path, branch name, an unused scratch port, explicit instruction to reproduce claims live rather
than trust them, told to actually run the app rather than just read tests). **If it flags
anything, even non-blocking, close what's cheap to close same-session** — this pattern held
across all four Tier 2 sprints this session: `version_diff` (clean 7/7 PASS, nothing to close),
`red_flags` (CONDITIONAL, 2 required + 2 non-blocking closed), `writing_style` (CONDITIONAL, 0
required + 2 non-blocking closed), `bulk_pdf` (CONDITIONAL, 2 required + 3 non-blocking closed,
including a required fix where the "obvious" literal resolution was tried, found to introduce a
worse problem — a genuine race — and reverted in favor of the evaluator's own offered alternative
of documenting the design decision instead of chasing an unachievable guarantee).
