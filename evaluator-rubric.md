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

_Prior sprint's scorecard (Tier 0 core loop, all PASS) is preserved in git history — see the
`docs: retroactive sprint-contract...` commit. This section holds the latest sprint only._

**Sprint:** `patient.match, context.history_injection, context.behavior_differs` ·
**Overall: PASS** (2 dimensions scored CONDITIONAL, both resolved — see below)

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Scope actually diffed:
3 new e2e test files + `sprint-contract.md` only — no production code changed (the underlying
plumbing was already correct from Tier 0; this sprint was proving it).

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | PASS        | All 7 Done conditions independently reproduced **live**, not just via the new tests: patient dedup confirmed via `SELECT * FROM patients` (1 row for shared identity across 2 providers); DOB-mismatch and name-mismatch both produced distinct `patientId`s; cross-provider history injection reproduced live — Provider B's Plan literally contained `"continuing management per prior visit on ... "` sourced from Provider A's saved note. |
| 2   | Correctness           | PASS        | Full manual curl flow: login → create encounters as A and B for identical patient identity → save A's note → B generates → B's Plan is history-informed → B's direct GET/PATCH on A's encounter both 403. |
| 3   | Invariants (§2)       | PASS*       | CONTEXT-INJECTION: solid pass — `ScribeController.generate()` has no `@Body()` param at all; evaluator sent a maximally adversarial body (fabricated `priorHistory`, fake transcript) directly at the live endpoint, zero effect. TENANT-ISOLATION: direct-CRUD access provably intact (403 confirmed live). Flagged as CONDITIONAL that patient-scoped (not provider-scoped) history injection is a genuine interpretation call `AGENTS.md` didn't explicitly settle — *resolved same session*: presented to the user, who confirmed this is intended; now recorded as a clarified invariant in `AGENTS.md` §2 TENANT-ISOLATION rather than an agent's unilateral call. |
| 4   | Verification quality  | PASS        | Traced `libs/ai/src/mock-provider.ts:61-64` — the "continuing management per prior visit" string is emitted *only* from the tool-call result, never derived from transcript text, so `context-behavior.e2e-spec.ts`'s assertion is structurally tied to injection, not coincidental text overlap. `context-injection.e2e-spec.ts`'s body-smuggling test isn't a strawman — evaluator independently sent an even more aggressive body live and confirmed no leak. |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 36/36 (29 prior + 7 new). |
| 6   | Scope discipline      | PASS        | Diff is exactly 3 test files + the contract doc; no model-client/controller/repository code changed. |
| 7   | Explainability        | PASS*       | CONTEXT-INJECTION design cleanly defensible and proven live. TENANT-ISOLATION carve-out was "arguable but not walkthrough-uncontested" at evaluation time — *resolved same session* via explicit human sign-off + the AGENTS.md clarification, so it's no longer resting only on the generator's own argument. |

\* Originally scored CONDITIONAL by the evaluator; both instances flagged the *same* underlying
gap (an unresolved interpretation of TENANT-ISOLATION), not two separate issues. Resolved by
surfacing the exact tradeoff to the user via `AskUserQuestion` rather than deciding unilaterally.

**Required fixes before closing:** none blocking. The evaluator's one recommendation — "get
explicit human sign-off on the TENANT-ISOLATION carve-out and record it in AGENTS.md itself" —
was acted on immediately (see `AGENTS.md` §2 TENANT-ISOLATION, "Clarified scope" paragraph).

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
