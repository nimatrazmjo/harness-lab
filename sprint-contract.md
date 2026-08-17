# Sprint Contract — AI Clinical Scribe

An agreement written **before** a sprint starts and checked **after** it ends. A "sprint" = one
focused work chunk, usually a single feature (or a tight cluster) from `feature-list.json`.

Its whole job is to pin down what "done" means **up front**, so the agent can't quietly move the
goalposts or drift into adjacent work — the two most common ways an agent fakes completion.

**How to use:**

- **Sprint start:** fill in _Active sprint_ and state it back before writing any code. If you
  can't express the _Done conditions_ as testable checks, the task isn't understood yet — clarify first.
- **Sprint end:** score the work against `evaluator-rubric.md`. If it passes, fold the outcome into
  `progress.md` and overwrite this file for the next sprint.

---

## Active sprint

**Feature(s):** `infra.env_secrets`, `infra.connection_pooling`, `infra.schema_erd`, `auth.login`,
`auth.roles_seed`, `auth.tenant_isolation`, `encounter.create`, `encounter.input`,
`scribe.generate_stream`, `scribe.soap_sections`, `scribe.icd10_assessment`, `note.inline_edit`,
`note.save`, `note.versioning_immutable`, `note.version_history`
**Goal (one sentence):** A provider can log in, start an encounter, paste a transcript, watch a
SOAP note stream in with real ICD-10 codes, edit it, and save it as an immutable, retrievable
version — all backed by Postgres+pgvector, with `infra.rds_postgres_private`/`infra.ec2_nginx_tls`
code-ready but not deployed (no AWS account access in this environment).
**Tier:** 0 · **Branch:** `feat/tier-0-core-loop`

_Note: this sprint predates `sprint-contract.md`/`evaluator-rubric.md` being added to the repo —
this is a retroactive contract written to check already-completed work against the new gates, not
a before-the-fact plan. Every sprint from here forward gets one of these filled first._

### In scope (only these)

- Monorepo scaffold (pnpm workspaces, shared TS/ESLint config)
- `libs/shared-types` (zod contracts), `libs/ai` (model-client abstraction + mock provider +
  clinical-safety gate + best-effort untested Bedrock provider)
- DB schema + migrations + ERD for all 8 tables
- API: secrets loading, bounded pg pool, JWT auth + roles + tenant isolation, encounter
  create/input, SSE-streamed scribe generation, pgvector ICD-10 search, immutable note versioning
  + save + history, seed script + ICD-10 embedding job
- Web: login, encounter list/create, workspace (transcript input → streaming generation → inline
  edit → save → version history)
- `infra/` config for RDS-private and EC2+nginx+TLS (written, NOT deployed)

### Explicitly OUT of scope (do not touch this sprint)

- Real AWS provisioning (needs a human with account access)
- All Tier 1/2 features: patient matching, context-injection-specific tests, ICD-10 search widget,
  admin CRUD, draft persistence, audit query surface, pioneer features
- Playwright web e2e (only Vitest component tests exist for web so far)

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [x] No secret/credential anywhere in the repo — `scripts/check-no-committed-secrets.sh` passes
- [x] `.env` git-ignored, `.env.example` placeholder-only — `git status` / `cat .gitignore`
- [x] One shared pg Pool, bounded, reused across requests — `pool.e2e-spec.ts` (30 concurrent
      requests stay ≤ `DB_POOL_MAX`; same `Pool` instance reused)
- [x] Schema created only via migrations; ERD defensible table-by-table — `apps/api/migrations/*`,
      `docs/erd.md`
- [x] Login issues a JWT (role + expiry claims), argon2-hashed passwords, deactivated → rejected —
      `auth.e2e-spec.ts`
- [x] 3 providers + 1 admin seeded with hashed passwords; roles enforced by a guard —
      `apps/api/src/seed/seed.ts` (run + verified), `roles.e2e-spec.ts`
- [x] Provider B requesting Provider A's encounter → 403; admin bypass works; list is scoped —
      `tenant-isolation.e2e-spec.ts`
- [x] Encounter created + linked to provider/patient, persists to RDS; patient deduped by
      (first,last,dob) — `encounter.e2e-spec.ts`
- [x] Transcript textarea accepts input, persists on the open encounter — `encounter.e2e-spec.ts`
      + `apps/web/.../input.test.tsx`
- [x] Generation streams >1 SSE chunk over measurable time, not one blob; SSE content-type headers
      — `scribe-stream.e2e-spec.ts`
- [x] All four SOAP sections present and populated from transcript content, not boilerplate —
      `soap-structure.e2e-spec.ts`
- [x] ≥1 ICD-10 code in the Assessment, sourced only from the embedded DB set (no fabrication) —
      `icd10-assessment.e2e-spec.ts` (asserts every returned code exists in `icd10_codes`)
- [x] All SOAP sections editable in place; edits preserved to save —
      `apps/web/.../edit.test.tsx`
- [x] Save writes to `note_versions` in RDS, tied to encounter + provider —
      `note-save.e2e-spec.ts`
- [x] Re-save INSERTs a new version; version 1 byte-for-byte unchanged; no UPDATE/DELETE path
      exists; concurrent saves don't collide on version_number —
      `note-versioning.e2e-spec.ts` (incl. 5-concurrent-save race test)
- [x] Version history lists every version with author + timestamp, read from RDS —
      `note-versioning.e2e-spec.ts` + `apps/web/.../history.test.tsx`

### Invariants that must still hold (AGENTS.md §2)

- [x] SECRETS, PERSISTENCE, TENANT-ISOLATION, VERSION-IMMUTABILITY, STREAMING, CONTEXT-INJECTION,
      POOLING, CLINICAL-SAFETY — all touched by this sprint, all covered by a test (see above)
- [ ] RDS-PRIVATE — **not achievable this sprint**: no real AWS account access. Local Postgres
      stands in for dev; `infra.rds_postgres_private`/`infra.ec2_nginx_tls` stay `blocked`.

### Verification plan (how each condition is proven)

- `pnpm verify` (lint+typecheck+test+build, all 4 packages) exits 0
- `pnpm --filter api run test:e2e` — 27 tests, real Postgres+pgvector, no mocked DB
- `pnpm --filter @scribe/ai run test` (10) + `pnpm --filter web run test` (10) + `pnpm --filter api run test` (7)
- Manual browser walkthrough (Chrome via MCP) against the compiled API + local Postgres: login →
  create encounter → paste transcript → watch streaming generation → verify real ICD-10 matches →
  edit → save → reload → confirm version history

### Definition of done

- [x] Every _Done condition_ checked with evidence (test names above, all currently green)
- [x] `pnpm verify` green; _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored **PASS** on all 7 dimensions by an independent subagent with no
      authorship context (see that file's Output section) — one non-blocking gap it found
      (no HTTP-level test for garbage input on the live SSE route) was closed same-session via
      `apps/api/test/edge-no-content.e2e-spec.ts`
- [x] `feature-list.json` status → `passing` for 15/17 Tier 0 items (2 `blocked` on AWS access),
      plus `edge.no_clinical_content` (Tier 1, its dependency chain was already satisfied and the
      new test genuinely covers it); `progress.md` + `session-handoff.md` updated
