# Build Checklist — AI Clinical Scribe

Phased sequence mapped to `feature-list.json`. Adjust the day labels to your actual timebox —
the **order** is the point, not the calendar. Two rules override everything:

1. **Infra first, features second.** The hardest thing to retrofit is the foundation.
2. **Don't start a tier until the previous tier is green.** Each slice ends in `pnpm verify`
   passing and a commit on a PR branch. Never commit to `main`.

---

## Phase 0 — Foundations (infra-first) · Tier 0 infra

The bet the challenge rewards: a rock-solid foundation beats more features.

- [x] Monorepo scaffold (`apps/api`, `apps/web`, `libs/shared-types`), pnpm workspaces
- [x] `pnpm setup` / `init.sh` brings up local Postgres+pgvector, migrates, seeds
- [ ] **infra.ec2_nginx_tls** — EC2 + nginx terminating TLS on 443, valid CA cert, Node only on localhost (blocked: needs real AWS account access)
- [ ] **infra.rds_postgres_private** — RDS in a private subnet, no public IP, SG locked to the EC2 SG (blocked: needs real AWS account access)
- [x] **infra.env_secrets** — Secrets Manager wired; `.env` gitignored; gitleaks in CI
- [x] **infra.connection_pooling** — one shared pool (`DatabaseService`); `/health` reads through it
- [ ] CI: `pnpm verify` (lint + typecheck + test + build) + gitleaks on every PR; branch protection on `main`

**Done when:** the deployed `/health` endpoint returns OK over HTTPS, reading from private RDS through the pool.

---

## Phase 1 — Auth & data spine · Tier 0

- [x] **infra.schema_erd** — normalized schema via migrations; index FKs, patient-match cols, vector col
- [x] **auth.login** — real login, hashed passwords (argon2/bcrypt), JWT/session with expiry
- [x] **auth.roles_seed** — provider + admin roles; seed ≥3 providers + 1 admin
- [x] **auth.tenant_isolation** — provider-scoped queries; A-reads-B ⇒ 403 (keep this test green forever)

**Done when:** each seeded account logs in, gets the right role surface, and cannot see another provider's data.

---

## Phase 2 — Core scribe workflow (the heart) · Tier 0

This is what must be airtight. Build it as one thin vertical slice, then harden.

- [x] **encounter.create** / **encounter.input** — start encounter (first/last/DOB), transcript textarea
- [x] **scribe.generate_stream** — POST `text/event-stream`; progressive render (nginx `X-Accel-Buffering: no`)
- [x] **scribe.soap_sections** — S / O / A / P structure
- [x] **scribe.icd10_assessment** — ≥1 semantically matched ICD-10 code + description in the Assessment
- [x] **note.inline_edit** → **note.save** → **note.versioning_immutable** → **note.version_history**

**Done when:** transcript in → SOAP note streams token-by-token → edited → saved → re-saved creates an
immutable v2 while v1 is still byte-for-byte retrievable. Test streaming asserts _multiple_ chunks.

---

## Phase 3 — Context injection & ICD-10 search · Tier 1

- [x] **patient.match** — match returning patients by first+last+DOB
- [x] **context.history_injection** — backend tool/function call fetches prior notes during generation
- [x] **context.behavior_differs** — returning vs first-time is demonstrably different
- [x] **icd10.vector_search** — pgvector cosine over 200–300 embedded codes (no external API)
- [x] **icd10.search_widget** → **icd10.append_assessment**

**Done when:** a returning patient's note references prior history (via the tool call, not the frontend);
the ICD-10 widget returns sensible codes for plain-English input and appends to the Assessment.

---

## Phase 4 — Admin & sessions · Tier 1

- [x] **admin.shell_route** — role-gated `/admin` route + nav shell (the attachment point for everything below)
- [x] **admin.view_all** — all encounters, filter by provider + date range (admin-guarded)
- [x] **admin.roster** — add / deactivate providers
- [x] **admin.templates_crud** — create / edit / delete templates
- [x] **admin.template_select** — provider picks a template; output visibly differs
- [x] **admin.template_live_update** — admin edit takes effect on next generation, no refresh
- [x] **admin.nav_wired** — shell nav (Encounters/Roster/Templates/Audit Log) routes to real pages, not placeholder `<li>` text
- [x] **ui.professional_redesign** — patient-identity header, primary/secondary/danger button system, type scale, auto-growing readable-font SOAP editor, brand mark, subtle row hover, consistent form controls, aligned panel grid (provider + admin)
- [x] **session.draft_persist** → **session.cross_device** — draft restores from RDS across refresh & devices

**Done when:** an admin template edit changes the very next generation without a refresh, and a mid-encounter
draft reappears after closing the browser and logging in elsewhere.

---

## Phase 5 — Edge cases, audit, polish, one pioneer · Tier 1 + one Tier 2

- [x] **edge.no_clinical_content** — gibberish in ⇒ graceful refusal, no hallucinated note
- [x] **edge.session_expired_save** — save with an expired session, zero data loss
- [x] **audit.trail** — saves + admin actions logged (actor / action / target / time) in RDS
- [x] Pick **one** pioneer feature — `pioneer.version_diff` done; all four Tier 2 pioneers now complete (`version_diff`, `writing_style`, `red_flags`, `bulk_pdf`)
- [ ] UI polish pass: clean, dense, high-trust clinical aesthetic — nothing visibly broken

**Done when:** both non-happy-paths are demoable on purpose, and the app _feels finished_ even where Tier 2 is absent.

---

## Phase 6 — Walkthrough rehearsal & demo

- [ ] Rehearse the three promised walkthroughs: **ERD** (defend every table), **auth layers**
      (issue → store → guard → expiry), **infra** (prove RDS is private, show nginx/TLS, show Secrets Manager)
- [ ] Prepare the **model-choice** answer (BAA-eligible; Bedrock/Azure keeps PHI in-boundary)
- [ ] Prepare the **prompt-structure** answer (server-side template + injected history, never client-side)
- [ ] Script the two edge-case demos so you _volunteer_ them
- [ ] Record the video / do the live session narrating each decision in: what → options → why → how-verified

**Done when:** you can explain every architectural decision without hesitation and every invariant in
`AGENTS.md §2` holds in the deployed app.
