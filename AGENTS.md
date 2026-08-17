# AGENTS.md — AI Clinical Scribe Platform

> **Agent-agnostic harness contract.** This is the single source of truth for how _any_ AI
> coding agent (Claude Code, Cursor, Copilot, Codex, …) works in this repo.
>
> - Claude Code: `ln -s AGENTS.md CLAUDE.md`
> - Cursor: add `Always read /AGENTS.md first` to `.cursor/rules`
> - Keep this file short and **earned** — every rule traces to a grading criterion or a real
>   failure we've seen. Delete nothing without a reason; add nothing speculative.

> **Session protocol — every agent, every session:**
>
> 1. **Read first:** `progress.md` (where we are) → `docs/PRODUCT.md` (what & why) →
>    `docs/ARCHITECTURE.md` (how it fits together) → `feature-list.json` (what's next).
> 2. **Work** the next `failing` feature (see §5).
> 3. **Update last:** prepend a dated entry to `progress.md` and flip the feature's `status`.

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
  `provider_id`. A provider must **never** read or write another provider's encounter.
  Admin-wide access is allowed **only** through an explicit admin guard. This is a security
  invariant — cover it with a test that must stay green.
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
tools/            # init.sh, seed scripts, icd10 embedding loader
docs/             # PRODUCT.md (what & why) + ARCHITECTURE.md (how it fits together)
AGENTS.md         # this file — the harness contract
progress.md       # rolling session log: read at start, update at end
feature-list.json # the prioritized, tier-ordered source of truth (work top-down)
```

**Context files (read at session start, keep current):** `progress.md`, `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md`. They carry _where we are_, _what & why_, and _how it fits_ respectively —
so a fresh session recovers context by reading, not re-exploring.

Shared request/response types live in `libs/shared-types` and are imported by both sides.
A backend contract change that breaks the frontend must fail at **typecheck**, not at runtime.

---

## 4. Commands (the agent-facing verbs)

```bash
pnpm setup          # ./tools/init.sh — install deps, start local pg+pgvector, run migrations, seed
pnpm dev            # run api + web
pnpm verify         # THE gate: lint + typecheck + test + build. Must exit 0 before "done".
pnpm test:e2e       # API e2e (supertest) + web e2e (Playwright)
pnpm db:migrate     # apply migrations (schema changes ALWAYS go through a migration)
pnpm db:seed        # 3 provider accounts + 1 admin (hashed passwords) + 200–300 ICD-10 codes
pnpm icd10:embed    # compute + store embeddings for the ICD-10 subset into pgvector
```

`pnpm verify` is the keystone. Run it after every slice. **Success is silent; failures are
verbose.**

---

## 5. Workflow rules

- **Work top-down through `feature-list.json` by tier. Do not start a Tier 1 item until every
  Tier 0 item is `passing`.** Prioritization is graded — an incomplete build that _feels
  finished_ beats a complete build with sloppy infra.
- One feature at a time: pick the next `failing` feature → implement the thinnest vertical
  slice → make its acceptance tests pass → flip it to `passing` → commit.
- Branch + PR per feature. **Never commit to `main`.** Conventional commit messages.
- Schema changes go through a migration (`pnpm db:migrate`). Never hand-edit the DB or a
  generated migration after it's applied.
- After finishing a feature, update its `status` in `feature-list.json` in the same commit.

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

1. Acceptance criteria in `feature-list.json` are met.
2. Its tests pass and `pnpm verify` exits 0.
3. No invariant in §2 is violated.
4. `status` flipped to `passing` in `feature-list.json` and committed on a branch/PR.
5. `progress.md` updated — a dated entry with what changed and the next feature.

---

## 12. The ratchet

Every agent mistake becomes a harness fix, not a one-off: forgot `provider_id` scoping → add a
lint rule or test; edited a generated file → add it to §10; declared done with a failing test →
tighten `pnpm verify`. Each incident tightens this file so the same mistake can't recur.
