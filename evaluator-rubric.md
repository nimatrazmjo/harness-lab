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

**Sprint:** `pioneer.version_diff` (first Tier 2 pioneer feature) · **Overall: PASS** (7/7, no
CONDITIONALs)

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope: entirely
`apps/web` — `diff.ts` (new, hand-rolled LCS line-diff, no external dependency), `VersionDiff.tsx`
(new), `__tests__/diff.test.tsx` (new, 9 tests), compare-dropdown wiring in
`EncounterWorkspacePage.tsx`, presentational CSS. Zero backend/`libs/` changes.

| #   | Dimension             | Verdict | Evidence / why |
| --- | ---------------------- | ------- | -------------- |
| 1   | Contract fulfillment  | PASS    | All 5 Done conditions reproduced live in a real browser (not just via the suite): a genuine Plan edit across two saved versions produced an exact removed/added line pair, unchanged sections tagged `(unchanged)`, v1-vs-v1 rendered a clean no-op diff. |
| 2   | Correctness           | PASS    | Ran the real API+web against local Postgres, logged in, drove the two `<select>` compare dropdowns via the DOM, screenshotted the resulting diff — matched the actual saved edit exactly. |
| 3   | Invariants (§2)       | PASS    | VERSION-IMMUTABILITY: confirmed by reading the code that `diff.ts`/`VersionDiff.tsx` only ever read `NoteVersion.note.*`, make no API calls, and write nothing back to `note_versions`. |
| 4   | Verification quality  | PASS    | Read the full test file — assertions check real diff content (specific added/removed lines), not "rendered without crashing." Separately wrote and ran its OWN adversarial test cases against the raw `diffLines` algorithm (deleted after, not left in the repo): disjoint text, both/either input empty, a repeated-line pattern (`a/b/a/b/a` vs `a/b/a`), a 1-character change in a long single line, and whitespace-only differences — all produced correct, coherent output, confirming the hand-rolled LCS isn't just passing on easy cases. |
| 5   | No regressions        | PASS    | `pnpm run verify` → exit 0. `pnpm --filter web run test` → 30/30 (21 prior + 9 new), exact match. |
| 6   | Scope discipline      | PASS    | Diff confined entirely to `apps/web` + `sprint-contract.md`; zero touches to `apps/api` or `libs/`. |
| 7   | Explainability        | PASS    | The LCS backtrack tie-break is standard and defensible; the ICD-10 diff is a straightforward set-diff keyed on code, matching the contract's stated scope. One documented edge case (not a bug): a code appearing in both versions with a changed description shows as "unchanged" with the new description — the contract itself states this is acceptable since ICD-10 codes are canonical and don't change meaning independently of the code. |

**Required fixes before closing:** none.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
