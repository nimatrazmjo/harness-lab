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

_Prior sprints' scorecards are preserved in git history (search commit messages for
"docs: record evaluator pass"). This section holds the latest sprint only._

**Sprint:** `pioneer.bulk_pdf` (fourth and final Tier 2 pioneer feature) · **Overall: CONDITIONAL
— both required fixes closed same session, along with all three non-blocking recommendations**

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope: new
`apps/api/src/patients/{patients.controller,patients.service,patients.module,pdf-export.service,
select-encounters-for-export,select-encounters-for-export.spec}.ts`,
`apps/api/test/bulk-pdf.e2e-spec.ts`, `+listForPatient` on `EncountersRepository`, `+pdfkit`/
`@types/pdfkit` dependency, `+PatientsModule` wiring. Confirmed the diff touches exactly what the
contract named.

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | CONDITIONAL → resolved | 6/7 Done conditions live-verified true; the "real, non-trivial PDF" condition failed for non-Latin-1 patient names — a CJK name (`田中`/`太郎`) 500'd with `ERR_INVALID_CHAR` from an unsanitized `Content-Disposition` filename (`patients.controller.ts`). **Closed same session**: sanitized the filename to a safe ASCII subset via a new `safeFilenameSegment` helper (PDF body text is untouched, still shows the real name), added a CJK-name regression test. |
| 2   | Correctness           | CONDITIONAL → resolved | Happy paths (own-only, cross-provider isolation, admin-sees-all, 403, no-saved-note, audit row) all independently reproduced live against a real running instance and real Postgres, with PDFs cross-checked by an independent `pypdf` install rather than trusting this sprint's own `extractText()` test helper. The Unicode-name path was broken — closed as in dimension 1. |
| 3   | Invariants (§2)       | PASS        | TENANT-ISOLATION reasoning (direct encounter-record export stays on the "forbidden" side of the CONTEXT-INJECTION carve-out, correctly distinguished from the generation-time patient-history read) confirmed sound. CLINICAL-SAFETY, SECRETS (audit metadata never carries transcript/PHI, verified across ~15 live exports including hostile patient names), PERSISTENCE, POOLING all hold. |
| 4   | Verification quality  | CONDITIONAL → resolved | `extractText()`'s hex-TJ-run reassembly independently cross-checked against `pypdf` and matched exactly — sound for what it covers. Gap: the original 8-test suite was 100% ASCII test data, so it never exercised the exact scenario that broke (dimension 1). **Closed**: added the CJK-name test and a no-audit-row-on-403 test (10 tests total). Also caught and fixed a latent test-only bug during this closing pass: the `uniquePatient()` helper used a per-process-reset counter, not a globally unique identity, so a rerun of the file in a fresh process could silently dedupe onto a prior run's patient row and produce a flaky count-based assertion — fixed by switching to a `uuid()` suffix, verified stable across three consecutive full reruns of the spec file. |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 94/94 at evaluation time, now 96/96 after the two added tests. |
| 6   | Scope discipline      | PASS        | Diff confined to exactly the files sprint-contract.md named; no frontend, no generation-path touches, only the one justified new dependency (`pdfkit`, checked for license/maintenance before adding). |
| 7   | Explainability        | CONDITIONAL → resolved | Tenant-isolation/403-vs-404/admin-bypass design held up as coherent and defensible. Evaluator's second required-fix framing ("fix the audit-log ordering, or explicitly document the delivery-confirmation distinction") was investigated literally first — a real `res.send()`-then-audit reorder was implemented and found to introduce a genuine, reproduced race (client receipt and server-side continuation aren't the same event, so "audit only after confirmed delivery" isn't an achievable HTTP semantic without added application-level acknowledgment). **Resolved by taking the evaluator's own documented-distinction option**: reverted to auditing immediately after `pdfExport.render()` succeeds (consistent with how every other audit call in this codebase already works, e.g. `note.save` logs after the DB write, not after the client's fetch resolves), with the reasoning recorded directly in `patients.service.ts` so it isn't silently rediscovered as a "bug" later. |

**Required fixes before closing — both closed same session:**
1. Non-Latin-1 patient name crashed the export (`ERR_INVALID_CHAR` on `Content-Disposition`) —
   fixed via `safeFilenameSegment`, regression test added.
2. Audit-logged-despite-failed-response ordering concern — root-caused to fix (1); the literal
   "audit after send" reorder was tried, found to be an unfixable race, and reverted in favor of
   documenting the audit-at-successful-generation semantic explicitly (the evaluator's own
   offered alternative resolution).

**Non-blocking recommendations — all three closed same session:** `doc.on("error", reject)` added
in `pdf-export.service.ts` as a defensive guard against an unhandled pdfkit stream error; the
per-encounter `providersRepo.findById` N+1 batched into one `findByIds` call; and the
test-suite-only patient-identity flakiness found while fixing the CJK test was fixed as a byproduct
of closing this pass properly rather than left for a future session to rediscover.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
