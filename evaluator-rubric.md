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

**Sprint:** `pioneer.writing_style` (third Tier 2 pioneer feature) · **Overall: CONDITIONAL —
no required fixes, both cheap non-blocking recommendations closed same session**

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope:
`libs/ai/src/writing-style.ts` (new, pure `inferWritingStyle`, no LLM call),
`libs/ai/src/mock-provider.ts` (`applyWritingStyle`, one-directional "Patient"→"Pt" regex
substitution), `apps/api/src/notes/notes.repository.ts` (+`getRecentByAuthor`, scoped to
`author_id`), `apps/api/src/scribe/scribe.service.ts` (computes the profile fresh per call),
`writing-style.e2e-spec.ts` (new). Confirmed the diff touches exactly what the contract named,
nothing else.

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | CONDITIONAL → resolved | 4/5 Done conditions directly evidenced. The 5th (fresh-per-call, proven live via curl: same fresh provider generated "Patient reports..." before saving pt-heavy history, then "Pt reports..." after) was true but not backed by the specific automated test the contract's own verification plan promised (comparing two generations for the same provider before/after their history changes). **Closed same session**: added exactly that test to `writing-style.e2e-spec.ts`. |
| 2   | Correctness           | PASS        | Live end-to-end walkthrough against a real running instance and real local Postgres: fresh provider → default output; 3 real saves via the actual `/notes` endpoint → next generation flips to "Pt"; DB-verified. Independently reproduced live in a real browser this session too (scratch ports 3017/5182): seeded 3 pt-heavy saves via curl, then watched the SSE-streamed note render "Pt reports mild knee pain..." live in the UI. |
| 3   | Invariants (§2)       | PASS        | TENANT-ISOLATION: `getRecentByAuthor` filters `WHERE author_id = $1` only — a second, fresh provider's generation was unaffected by the first provider's learned style, both in the evaluator's e2e test and my live browser walkthrough. CONTEXT-INJECTION: grepped `apps/api/src`, `apps/web/src`, `libs/shared-types/src` — zero client-facing references to `writingStyle`; computed purely server-side. CLINICAL-SAFETY: substitution is terminology-only, one-directional, never touches ICD-10 codes/descriptions or dosages. |
| 4   | Verification quality  | CONDITIONAL → resolved | Unit tests for `inferWritingStyle` are real, not tautological — evaluator independently reproduced them plus its own adversarial boundary cases (3-vs-1 flips, 3-vs-2 stays default, HTML-like/large-count inputs) with no discrepancy. Gap was the missing same-provider before/after e2e test noted in dimension 1 — closed. |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 85/85 at evaluation time, now 86/86 after the added test. `pnpm --filter @scribe/ai run test` → 33/33. |
| 6   | Scope discipline      | PASS        | `git diff` confirmed exactly the files the contract named, plus the expected one-line `index.ts` export. Zero touches to `templateApplied`, red-flags, or any frontend file. |
| 7   | Explainability        | PASS        | The abbreviation-preference proxy is a disclosed, reasonable simplification given the mock model has no real generative voice to imitate — the contract states this up front, not as a stretch goal. One soft spot noted: bare "pt" counting can't distinguish "patient" from other clinical uses of "PT" (physical therapy, prothrombin time) — **closed same session** via a doc comment on `inferWritingStyle` acknowledging the limitation explicitly. |

**Required fixes before closing:** none — mechanism was correct and every invariant held even
before this pass.

**Non-blocking recommendations — both closed same session:** (1) added the same-provider
before/after e2e test the contract's verification plan promised but the suite didn't yet have;
(2) added a doc comment on `inferWritingStyle` disclosing the "pt" vs. clinical-PT ambiguity.

**Left as a conscious, undecided product question (not a bug):** for long-lived provider
accounts, the last-10-saved-notes window can go "sticky" if older saves dilute a newer, real
preference shift (observed against the dev-seeded `dr.chen@clinic.dev` account, whose accumulated
manual-testing history correctly kept it at the default per the documented formula). Whether a
larger or adaptive window is warranted is a future product decision, not a defect in this sprint.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
