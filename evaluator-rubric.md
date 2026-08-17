# Evaluator Rubric — AI Clinical Scribe

The scorecard a **separate evaluation pass** uses to decide whether a sprint is _actually_ done —
judged skeptically, with evidence, against `sprint-contract.md`. This is the counterweight to the
best-documented failure mode in agentic coding: **agents grade their own work far too generously.**

## How to run it (this is what makes self-verification trustworthy)

- **Separate the evaluator from the generator.** Run this as a **fresh session or a subagent that
  did not write the code**. Give it only: the diff, `sprint-contract.md`, this rubric, and the
  ability to run the app and tests. A clean context can't rationalize what it just wrote.
- **Adversarial stance.** Default every dimension to **FAIL**. Flip to PASS only against concrete
  evidence. Actively try to _break_ the feature — don't just confirm the happy path.
- **Evidence, not vibes.** Every PASS cites proof: a test name + its output, a `file:line`, a
  command result, or a screenshot. "Looks right" scores FAIL.

## Verdicts

- **PASS** — met, with cited evidence.
- **CONDITIONAL** — met with a noted caveat/risk; may proceed only if non-blocking.
- **FAIL** — not met, or no evidence. Blocks the sprint from closing.

---

## Dimensions (score every one)

**1. Contract fulfillment.** Every _Done condition_ in `sprint-contract.md` is checked with
evidence. Any unchecked condition → FAIL.

**2. Correctness (real end-to-end).** The actual user flow works when exercised by hand, not only
in unit tests. Run it, don't infer it.

**3. Invariants intact — AGENTS.md §2 (hard gates; any violation FAILS the sprint).**

- Secrets: nothing sensitive committed or staged.
- Tenant isolation: a provider cannot reach another provider's data — prove the 403 path.
- Version immutability: edits INSERT a new version; prior versions unchanged and retrievable.
- Persistence: durable data in RDS only.
- Pooling: one shared pool; no per-request connections.
- Streaming: renders progressively (multiple chunks over time), not spinner-then-dump.
- Context injection: prior history arrives via a backend tool call, not the frontend.
- Clinical safety: empty/garbage input yields no fabricated note or code; provider edits before save.

**4. Verification quality (are the tests real?).** Inspect the tests themselves. Do they assert the
meaningful thing or trivially pass? Streaming asserts >1 chunk; isolation asserts 403; no-content
asserts refusal. Weak or tautological tests → FAIL this dimension **even if green**.

**5. No regressions.** `pnpm verify` green; previously-passing features still pass; _Leave clean_
gate passed.

**6. Scope discipline.** Nothing built outside the contract; out-of-scope items untouched. Scope
creep → CONDITIONAL or FAIL.

**7. Explainability (walkthrough readiness).** Every non-trivial decision can be defended aloud —
model choice, schema, streaming approach, VPC/secrets. If it can't be explained, it isn't done.

---

## Output (the evaluator fills this in)

**Sprint:** `infra.env_secrets, infra.connection_pooling, infra.schema_erd, auth.login,
auth.roles_seed, auth.tenant_isolation, encounter.create, encounter.input,
scribe.generate_stream, scribe.soap_sections, scribe.icd10_assessment, note.inline_edit,
note.save, note.versioning_immutable, note.version_history` (Tier 0 core loop) · **Overall: PASS**

Evaluated 2026-08-17 by a fresh subagent with no authorship context, per this rubric's own
"separate the evaluator from the generator" instruction — see `sprint-contract.md` for the
done-conditions it checked against.

| #   | Dimension            | Verdict | Evidence / why |
| --- | -------------------- | ------- | -------------- |
| 1   | Contract fulfillment | PASS    | All 15 checked Done conditions in `sprint-contract.md` verified independently; the 2 unchecked (RDS-PRIVATE, EC2-nginx-TLS) are honestly left unchecked/`blocked`, not claimed. |
| 2   | Correctness          | PASS    | Own curl session: login → create encounter (201) → PATCH transcript → `POST /scribe/generate` streamed 84 SSE chunks in 0.146s with real content → saved note twice → `SELECT * FROM note_versions` confirmed v1 untouched, v2 inserted. |
| 3   | Invariants (§2)      | PASS    | Own curl as Provider B against Provider A's encounter got 403 on GET/PATCH/generate/notes-history/notes-save. Empty + keyboard-mash transcripts both returned only `insufficient_content`, no fabricated note. Grepped for `UPDATE`/`DELETE` on `note_versions` — none exist. `pool.e2e-spec.ts` asserts bounded count + instance reuse. `scripts/check-no-committed-secrets.sh` exit 0, `.env` untracked. Tool closures (`patientHistoryTool`/`icd10CandidateTool`) confirmed server-side only. |
| 4   | Verification quality | PASS    | Read the streaming, tenant-isolation, ICD-10, versioning, and pooling e2e tests directly — all assert the meaningful thing (chunk count + time spread, literal 403, DB-membership of returned codes, byte-level row check + 5-way concurrent-save race, bounded pool count), none tautological. Gap noted: no e2e-level HTTP test for garbage input on the live `/scribe/generate` route (only unit-tested at `hasClinicalContent`) — closed same day, see `edge-no-content.e2e-spec.ts`. |
| 5   | No regressions        | PASS    | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 27/27, matching the contract's claimed count exactly. |
| 6   | Scope discipline     | PASS    | Only Tier 0 flipped in `feature-list.json`; Tier 1/2 untouched. No Playwright added (contract said Vitest-only). `/admin` verified as a bare smoke-test gate, not a shipped Tier 1 surface (404 on `/admin/encounters`, correct 403/200 split on `/admin/ping`). |
| 7   | Explainability       | PASS    | `docs/erd.md` matches the migration table-by-table including every claimed index. SSE-over-POST rationale and the `pg_advisory_xact_lock` concurrency design both hold up and were proven live, not just asserted. |

**Required fixes before closing:** none — no blocking issues found.

**Non-blocking follow-up (applied same session):** added `apps/api/test/edge-no-content.e2e-spec.ts`
hitting the live SSE endpoint with empty/garbage transcripts, closing the one coverage gap the
evaluator flagged in dimension 4.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
