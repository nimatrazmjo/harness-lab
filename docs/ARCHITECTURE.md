# Architecture — AI Clinical Scribe

The **how it fits together**. Read this to keep changes consistent with the intended shape.
Prose and structure only — the coding agent writes the implementation against this map.
(Intent and scope live in `PRODUCT.md`.)

## Shape
Monorepo (pnpm workspaces baseline):
- `apps/api` — NestJS: auth, encounters, scribe (streaming), icd10, admin, audit.
- `apps/web` — React/Vite: provider workspace + admin dashboard.
- `libs/shared-types` — DTOs + zod schemas shared by api and web (one contract; typecheck catches drift).
- `libs/ai` — prompt templates + the model-client interface + tool/function definitions.

## Request path — generate a note (the core flow)
1. Provider POSTs encounter input to the streaming endpoint (SSE over POST — see Streaming).
2. API runs a **clinical-content safety check**; if empty/garbage, it emits `insufficient_content` and stops.
3. API loads the **active template server-side** (read fresh each call → live template switching works).
4. API fetches **prior patient history via a backend tool/function call** (never through the client);
   empty for first-time patients, so behavior differs by construction.
5. API assembles the prompt (template + history + transcript) and **streams** model tokens back.
6. On completion, API parses to structured SOAP and **validates ICD-10 codes against the DB**
   (drops hallucinated ones) before the note becomes editable.
7. Provider edits inline → saves → a new **immutable version** is written; an **audit** row is logged.

## Streaming
Server-Sent-Events framing over a **POST** response (the transcript is a large, PHI-shaped body and
the browser `EventSource` API is GET-only). The frontend reads it via `fetch` + a ReadableStream.
nginx must **not buffer** the stream (`proxy_buffering off` + `X-Accel-Buffering: no`) or progressive
render collapses into spinner-then-dump.

## Persistence
- **AWS RDS PostgreSQL** is the only durable store: encounters, note_versions, patients, providers,
  templates, audit_logs, drafts, icd10_codes. No SQLite / in-memory / flat files.
- **pgvector** powers ICD-10 semantic search (cosine distance, HNSW index) — no external ICD-10 API.
- **One shared connection pool** per process; schema evolves **only** through migrations.
- Core tables (normalized): providers, patients, encounters, note_versions (append-only), templates,
  audit_logs, drafts, icd10_codes (+ vector). Index FKs, patient-match columns, and the vector column.

## AI layer
- A single **model-client interface**; the concrete provider is **BAA-eligible** (AWS Bedrock or
  Azure OpenAI) because notes are PHI-shaped. Bedrock keeps inference in the same AWS boundary as RDS.
- Two roles: a strong low-latency **generation** model (streaming + structured output + room for
  injected history) and a cheap **embedding** model for ICD-10 search. Embedding dimension must match
  the DB vector column.
- Prompts are assembled **server-side** only; templates and history never come from the client.

## Security & tenancy
- JWT/session auth; two roles (provider, admin); passwords hashed.
- **Tenant isolation:** every provider-facing query is scoped to the authenticated provider; admin
  breadth only through an explicit admin guard.
- Secrets from **AWS Secrets Manager** (never committed); PHI and secrets never logged.

## Infrastructure
- **EC2** runs the app; **nginx** terminates TLS (valid CA cert) and reverse-proxies to Node on
  localhost — the app process is never directly on 80/443.
- **RDS is private** (no public IP; security group accepts 5432 only from the EC2 SG).
- Secrets Manager reached via an **IAM role** on the instance (no keys on disk).

## Key decisions (rationale — defend these in the walkthrough)
- **SSE over WebSockets** — generation is one-directional; SSE is simpler and rides HTTP/nginx cleanly.
- **pgvector over a separate vector DB** — at this scale Postgres does semantic search fine and keeps
  everything in the required store.
- **Async-generator generation pipeline** — decouples logic from transport, so it's unit-testable
  without HTTP.
- **BAA-eligible model, in-boundary** — treats notes as PHI even in a demo; a maturity signal.
- **Immutable versioning + audit** — clinical documentation is legally sensitive; never destroy history.
