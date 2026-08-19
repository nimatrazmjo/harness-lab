# AGENTS.md — AI Clinical Scribe Platform

> **Agent-agnostic harness contract.** This is the single source of truth for how _any_ AI
> coding agent (Claude Code, Cursor, Copilot, Codex, …) works in this repo.
>
> - Claude Code reads `CLAUDE.md`, **not** `AGENTS.md`. Add a one-line `CLAUDE.md` containing
>   `@AGENTS.md` (imports this file; works cross-platform), or `ln -s AGENTS.md CLAUDE.md` on macOS/Linux.
> - Cursor: add `Always read /AGENTS.md first` to `.cursor/rules`
> - Keep this file short and **earned** — every rule traces to a grading criterion or a real
>   failure we've seen. Delete nothing without a reason; add nothing speculative.

> **Session protocol — every agent, every session:**
>
> 1. **Resume & verify baseline:** read `session-handoff.md`, then run `bash init.sh` to verify
>    the project builds cleanly. **If it fails, fix build errors before proceeding** — never
>    build new work on a broken baseline. Then complete the rest of the _Start clean_ gate in
>    `clean-state-checklist.md`.
> 2. **Orient:** skim `progress.md` (where we've been), `docs/PRODUCT.md` + `docs/ARCHITECTURE.md`
>    (what/why + how), `feature-list.json` (what's next, by tier), and `BUILD-CHECKLIST.md`
>    (the phased build order and each phase's "Done when" gate). Working on containers/Terraform/
>    CI-CD? Use `/devops` instead — own isolated workstream, see `devops/AGENTS.md` (§5).
> 3. **Work** the next `failing` feature (see §5), or resume the in-flight one from the handoff.
> 4. **Hand off:** run the _Leave clean_ gate in `clean-state-checklist.md`, then **overwrite**
>    `session-handoff.md` with the current snapshot, prepend a dated entry to `progress.md`, and
>    flip any finished feature's `status`.

---

## 1. What we're building

A provider-facing AI clinical documentation tool. A physician pastes an encounter transcript
(or types freeform observations); the AI **streams back** a structured **SOAP note**
(Subjective, Objective, Assessment, Plan) with suggested **ICD-10** codes matched to the
clinical content. It must look and feel like a high-trust clinical tool — clean, dense,
professional — not a consumer app.

**Stack:** NestJS (API) + React/Vite (web), TypeScript end-to-end, monorepo via pnpm
workspaces. **PostgreSQL on AWS RDS** with the `pgvector` extension. Hosted on **AWS EC2
behind nginx**. Secrets via **AWS Secrets Manager**. AI via a **BAA-eligible** provider
(AWS Bedrock or Azure OpenAI — see §8).

---

## 2. Non-negotiable invariants — DO NOT VIOLATE

These are the challenge's grading criteria expressed as rules. Breaking any one loses points
directly. If a change would violate one, stop and flag it instead.

- **[SECRETS]** Never hardcode DB credentials or API keys. Never write real secrets to _any_
  file. `.env` is git-ignored; real values load from AWS Secrets Manager / Parameter Store at
  runtime. `.env.example` documents shape only, with placeholder values. Assume the repo is
  scanned for committed secrets.
- **[PERSISTENCE]** Everything durable — encounters, note_versions, patients, providers,
  templates, audit_logs, drafts, icd10_codes — lives in **RDS Postgres**. No SQLite, no
  in-memory stores, no flat files for anything that must survive a restart.
- **[TENANT-ISOLATION]** Every provider-facing query is scoped to the authenticated
  `provider_id`. A provider must **never** read or write another provider's encounter
  **record** — no direct GET/PATCH/list access to it, ever. Admin-wide access is allowed
  **only** through an explicit admin guard. This is a security invariant — cover it with a
  test that must stay green.
  **Clarified scope (human sign-off 2026-08-17):** this governs direct access to another
  provider's _encounter records_. It does **not** forbid patient-scoped clinical context —
  a returning patient's prior assessment/plan (fetched via the backend history tool during
  generation, see [CONTEXT-INJECTION]) may inform generation for **any** provider currently
  treating that same patient, not just the original author. This mirrors continuity of care
  in a real shared EHR: the isolation boundary is the encounter record, not the patient's
  clinical history. If this scope ever needs tightening (e.g. requiring an explicit care-team
  grant before history crosses providers), that's a deliberate product change, not a bug fix.
- **[VERSION-IMMUTABILITY]** Editing a note **INSERTs** a new `note_versions` row. Never
  `UPDATE` or `DELETE` an existing version. Prior versions are retrievable forever with author
  and timestamp.
- **[STREAMING]** Note generation streams progressively (token-by-token) via **SSE**. No
  spinner-then-dump. If you can't stream it, it's not done.
- **[POOLING]** One shared connection pool per process. **Never** open a DB connection per
  request.
- **[CONTEXT-INJECTION]** Prior-patient history is fetched by a **backend tool/function call
  during generation** — never stuffed into the frontend prompt or sent from the client.
- **[RDS-PRIVATE]** RDS has no public IP; its security group accepts 5432 only from the EC2
  security group. The Node process is never exposed directly on 80/443 — nginx terminates TLS
  and proxies to it on localhost.
- **[CLINICAL-SAFETY]** The AI **drafts**; the provider **reviews and edits before save**
  (human-in-the-loop). If a transcript has no clinically meaningful content, return a graceful
  "insufficient content" response — **never fabricate** a SOAP note or an ICD-10 code.

---

## 3. Repo layout

```
apps/
  api/            # NestJS — auth, encounters, scribe (SSE), icd10, admin, audit
  web/            # React/Vite — provider workspace, admin dashboard
libs/
  shared-types/   # DTOs + zod schemas shared by api AND web (single contract source)
  ai/             # prompt templates, model client, tool/function-call definitions
infra/            # nginx conf, docker-compose (local pg+pgvector), IaC / deploy notes
tools/            # tools/init.sh (full env bootstrap), seed scripts, icd10 embedding loader
docs/             # PRODUCT.md (what & why) + ARCHITECTURE.md (how it fits together)
init.sh            # fast build-verify gate: install + typecheck + build. Run every session.
AGENTS.md          # this file — the harness contract (source of truth)
CLAUDE.md          # one-line bridge: imports AGENTS.md for Claude Code
progress.md        # rolling log: durable, append-only history (append at session end)
session-handoff.md # warm baton-pass: overwritten each session, read first to resume
clean-state-checklist.md # start-clean / leave-clean gates run at both ends of a session
feature-list.json  # the prioritized, tier-ordered source of truth (work top-down)
devops/             # SEPARATE, on-demand workstream (containers/Terraform/CI-CD) — its own
                    # AGENTS.md + feature-list.json, invoked via the `/devops` skill so it never
                    # loads into a normal product-coding session. See §5.
BUILD-CHECKLIST.md # phased day-by-day build sequence — the concrete order to work the tiers in
sprint-contract.md # per-feature "done" agreed BEFORE coding (prevents scope drift)
evaluator-rubric.md # adversarial scorecard applied AFTER coding (separate eval pass)
```

**Context files (read at session start, keep current):** `session-handoff.md` (where we STOPPED —
read first to resume), `progress.md` (where we've been), `docs/PRODUCT.md` (what & why),
`docs/ARCHITECTURE.md` (how it fits). A fresh session recovers context by reading these, not re-exploring.

Shared request/response types live in `libs/shared-types` and are imported by both sides.
A backend contract change that breaks the frontend must fail at **typecheck**, not at runtime.

---

## 4. Commands (the agent-facing verbs)

```bash
bash init.sh        # fast build-verify gate: install + typecheck + build. Run at every session start.
pnpm setup          # ./tools/init.sh — ONE-TIME env bootstrap: local pg+pgvector, migrations, seed
pnpm dev            # run api + web
pnpm verify         # THE gate: lint + typecheck + test + build. Must exit 0 before "done".
pnpm test:e2e       # API e2e (supertest) + web e2e (Playwright)
pnpm db:migrate     # apply migrations (schema changes ALWAYS go through a migration)
pnpm db:seed        # 3 provider accounts + 1 admin (hashed passwords) + 200–300 ICD-10 codes
pnpm icd10:embed    # compute + store embeddings for the ICD-10 subset into pgvector
```

Three gates, three jobs — don't confuse them: **`bash init.sh`** is the first thing you run every
session (no Docker, no DB, just install/typecheck/build — fast and side-effect-free). **`pnpm
verify`** is the fuller gate (adds lint + tests) — required green before a feature is `passing`.
**`pnpm setup`** is a one-time (or after-infra-change) environment bootstrap — it touches Docker
and the database, so it's heavier and isn't a per-session habit.

`pnpm verify` is the keystone for finishing a feature. **Success is silent; failures are
verbose.**

---

## 5. Workflow rules

- **Work top-down through `feature-list.json` by tier. Do not start a Tier 1 item until every
  Tier 0 item is `passing`.** Prioritization is graded — an incomplete build that _feels
  finished_ beats a complete build with sloppy infra.
- Follow `BUILD-CHECKLIST.md` for the concrete phase order within that tier structure — it breaks
  each tier into phases with a specific "Done when" gate. Check off its boxes as features flip to
  `passing`, and add a phase/bullet there whenever a feature is added or reordered in
  `feature-list.json` (e.g. `admin.shell_route` landed in Phase 4 ahead of `admin.view_all`) —
  the two files must stay in sync.
- One feature at a time: pick the next `failing` feature → implement the thinnest vertical
  slice → make its acceptance tests pass → flip it to `passing` → commit.
- **Contract before code, evaluate after:** at sprint start fill `sprint-contract.md` (the
  testable "done" for this feature); at sprint end score the work against `evaluator-rubric.md` —
  ideally in a _separate_ evaluation pass, since an agent grading its own fresh work skews positive.
- Branch + PR per feature. **Never commit to `main`.** Conventional commit messages.
- Schema changes go through a migration (`pnpm db:migrate`). Never hand-edit the DB or a
  generated migration after it's applied.
- After finishing a feature, update its `status` in `feature-list.json` in the same commit.
- **DevOps work (containers, Terraform, CI/CD) is a separate, on-demand workstream — invoke
  `/devops`, don't work it inline here.** It has its own harness contract (`devops/AGENTS.md`)
  so infra detail never loads into a normal product-coding session. Its Tier 0 items
  (`devops.terraform_networking_rds`, `devops.terraform_compute_envs`) are the real-AWS
  execution of this file's `infra.rds_postgres_private` / `infra.ec2_nginx_tls` — flip those two
  to `passing` once the devops workstream verifies them for real; don't duplicate acceptance
  criteria in both places.

---

## 6. Testing requirements (the loops that catch the breakable, graded parts)

Purpose-built tests, not just unit coverage:

- **Streaming:** hit the SSE endpoint and assert it yields **multiple chunks over time**, not
  one blob.
- **Tenant isolation:** Provider A requesting Provider B's encounter gets **403**.
- **Version immutability:** edit a note twice; assert version 1's content is byte-for-byte
  unchanged and still retrievable with its original author + timestamp.
- **Non-happy-path AI:** empty/garbage clinical input returns the graceful path — asserts **no
  fabricated SOAP note**.
- **Context injection:** a returning patient's generation makes the backend history tool call;
  a first-time patient does not. Behavior is **demonstrably different**.
- **Live template switch:** admin edits the active template; the provider's next generation
  uses it **without a page refresh**.
- **Infra (manual, rehearsed):** prove RDS rejects public connections and nginx terminates TLS.

Let CI and tests be the judge — do **not** rely on the AI's self-assessment that streaming or
isolation "works."

---

## 7. Security & secrets

- Passwords hashed with argon2/bcrypt — never stored or logged in plaintext.
- JWT or session tokens with expiry; handle expiry gracefully (no data loss on save — see the
  session-expired edge case).
- No secret, PHI, or token is ever written to logs.
- Least-privilege IAM role on the EC2 instance for Secrets Manager access — no long-lived keys
  on disk.

---

## 8. AI / model rules

- Use a **BAA-eligible** provider because clinical notes are PHI-shaped. In 2026 that includes
  AWS Bedrock, Azure OpenAI, OpenAI, Anthropic, and Google. Default to **AWS Bedrock** (or
  Azure OpenAI) so inference stays inside the same compliant AWS boundary as RDS.
- Prompts live in `libs/ai` — versioned, reviewed, never inlined in controllers.
- Two model roles: a strong low-latency model for **SOAP generation** (streaming + structured
  output + context window large enough for injected history); a cheap **embedding** model for
  ICD-10 vector search.
- ICD-10 search is **pgvector cosine similarity** over the embedded subset in RDS — **no
  external ICD-10 API**.
- Templates and prior-history are injected **server-side** into the prompt, never from the
  client.

---

## 9. Domain glossary

- **SOAP note:** Subjective (patient-reported), Objective (measurable findings/vitals/exam),
  Assessment (diagnoses + ICD-10 codes), Plan (treatment/follow-up).
- **ICD-10:** standardized diagnosis codes (e.g. `M54.5` low back pain). Assessment must carry
  ≥1 code + description semantically matched to the content.
- **Roles:** `provider` (own encounters only) and `admin` (all encounters, roster, templates).
- **Template:** a structured prompt shaping generation for an encounter type (ortho follow-up,
  new-patient eval, urgent care, …). Providers pick one before generating.
- **Encounter:** one visit — patient + input transcript + generated/edited note + versions.

---

## 10. Never touch

- Files in `dist/`, build output, or anything `*.generated.*`.
- `.env` files or real secret values.
- Applied migrations (add a new migration instead).
- An existing `note_versions` row (append only).

---

## 11. Definition of done (per feature)

1. All `sprint-contract.md` _Done conditions_ are checked **with evidence**.
2. Its tests pass and `pnpm verify` exits 0.
3. No invariant in §2 is violated.
4. `evaluator-rubric.md` scored **PASS** (or an accepted CONDITIONAL) — ideally a separate pass.
5. `status` flipped to `passing` in `feature-list.json` and committed on a branch/PR.
6. `progress.md` updated — a dated entry with what changed and the next feature.
7. If this feature is passing after a prior failure, set `fixPrompt` in `feature-list.json` to
   the exact prompt that fixed it — this **replaces** any prior value, it never accumulates into
   a log. Each replacement should be cleaner and more structured than what it replaces, and
   scoped only to this feature: no unrelated fixes riding along in the same edit.

---

## 12. The ratchet

Every agent mistake becomes a harness fix, not a one-off: forgot `provider_id` scoping → add a
lint rule or test; edited a generated file → add it to §10; declared done with a failing test →
tighten `pnpm verify`. Each incident tightens this file so the same mistake can't recur.
