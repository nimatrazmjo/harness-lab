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

**Sprint:** `pioneer.red_flags` (second Tier 2 pioneer feature) · **Overall: CONDITIONAL → both
required fixes closed same session**

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope:
`libs/ai/src/red-flags.ts` (new, deterministic regex pattern list, no LLM call),
`apps/api/src/encounters/encounters.controller.ts` (+`GET :id/red-flags`, tenant-scoped),
`red-flags.e2e-spec.ts` (new), frontend wiring in `EncounterWorkspacePage.tsx` (advisory banner,
never disables Generate). Confirmed zero touches to `ScribeService`/`MockModelClient` — detection
is fully decoupled from generation.

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | PASS        | All 6 Done conditions reproduced live via curl: owner GET returns matched flags, non-owner 403, no-token 401, multiple distinct flags all returned. |
| 2   | Correctness           | CONDITIONAL | Happy path works end-to-end in the browser. But adversarially forcing network latency uncovered a **pre-existing, out-of-scope bug**: a cross-cycle race in the transcript-autosave debounce (present since Tier 0, not introduced by this sprint — the intra-cycle await fix this sprint made is itself correct) can persist a stale transcript and generate a note from it under elevated latency. Confirmed via direct DB query and a screenshot of the resulting note. Tracked as its own follow-up in `progress.md`, not bundled into this sprint's fix. |
| 3   | Invariants (§2)       | PASS        | TENANT-ISOLATION and CLINICAL-SAFETY (advisory-only, verified the Generate button's `disabled` state directly, then clicked it while flags were showing — generation proceeded normally) both hold. The race in dimension 2 is a separate, pre-existing mechanism this diff didn't create. |
| 4   | Verification quality  | FAIL → fixed same session | Wrote independent adversarial inputs against `detectRedFlags` and found real false negatives the shipped test suite didn't cover: the literal phrase "difficulty breathing" didn't match its own pattern; plural "seizures"/"convulsions" didn't match (`\bseizure\b` fails on "seizures" — word-boundary placement bug); "sudden onset severe headache" missed; a chest-pain pattern's `.{0,40}` gap couldn't span a line break. **Closed same session**: fixed all four (2 were the evaluator's explicit required fixes; 2 were its non-blocking recommendations, fixed anyway since they were cheap and clearly real), added 5 regression tests, and added an explicit code comment documenting the deliberate no-negation-detection design choice (over-flag, not under-flag, for an advisory safety tool). |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 82/82. `pnpm --filter @scribe/ai run test` → 22/22 at evaluation time, now 27/27 after the regression tests. |
| 6   | Scope discipline      | PASS        | Grepped `apps/api/src/scribe/*` and `mock-provider.ts` — zero references to red-flag detection; confirmed fully decoupled from generation as the contract requires. |
| 7   | Explainability        | CONDITIONAL → resolved | The pattern gaps (dimension 4) were unacknowledged before this pass; now documented via the negation-design comment and covered by tests. The autosave race (dimension 2) is now explicitly tracked rather than silently left for a future session to rediscover. |

**Required fixes before closing:** both closed same session — `difficulty-breathing` literal
phrase, `seizure`/`convulsion` plural forms. (Non-blocking recommendations also closed: multiline
gap matching, negation-behavior documentation.)

**Tracked, not fixed here** (pre-existing, out of this sprint's contract): a cross-cycle race in
`EncounterWorkspacePage`'s transcript-autosave debounce can persist/generate from a stale
transcript under elevated network latency. Needs its own sprint-contract since it touches core
Tier 0/1 code — see `progress.md`.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
