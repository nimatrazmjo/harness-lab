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

**Sprint:** `icd10.vector_search, icd10.search_widget, icd10.append_assessment` ·
**Overall: PASS** (1 dimension scored CONDITIONAL, non-blocking, closed same session — see below)

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope: 1 new e2e
file, 1 new frontend API client, 1 new widget component + its 2 test files, a 14-line wiring
diff in `EncounterWorkspacePage.tsx`, widget-scoped CSS.

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | PASS        | All 5 Done conditions reproduced live: search returns ranked code+description+similarity sourced only from `icd10_codes` (SQL-verified against all 234 rows); widget renders results; click appends `{code,description}`; dedup enforced both client-side (disabled button) and in `EncounterWorkspacePage`'s `onAppendIcd10`; save persists whatever `icd10Codes` array it's handed (unchanged `NotesService.save`), confirmed live. |
| 2   | Correctness           | PASS        | Live curl chain through the actual Vite dev-proxy path (not just the isolated component) using the exact query-string shape `icd10.ts` builds — 200 with real, relevant results (`M54.5` top hit for "low back pain"). |
| 3   | Invariants (§2)       | PASS        | CLINICAL-SAFETY: search path is 100% DB-backed, zero fabrication (every returned code verified to exist). Auth required (401 without token). SQL-injection-flavored query treated as harmless plain text (parameterized query confirmed safe, row count unchanged). Confirmed the backend does NOT independently re-validate that codes on save came from a real search — but this is unchanged, pre-existing Tier 0 behavior (human-in-the-loop editing already trusts the client's full note payload on save), not a new gap this sprint introduced. |
| 4   | Verification quality  | PASS        | Limit edge cases (0, -5, 10000, non-numeric, missing) all independently reproduced live, matching `Icd10SearchRequestSchema`'s `z.coerce.number().int().min(1).max(20).default(10)`. e2e test asserts "no code outside `icd10_codes`," not tautological. |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 40/40. `pnpm --filter web run test` → 17/17 at evaluation time (now 21/21 after the follow-up below). |
| 6   | Scope discipline      | PASS        | Nothing outside the icd10 widget touched — no admin/audit/drafts/embedding-model/dataset changes. |
| 7   | Explainability        | CONDITIONAL | Flagged that `widget.test.tsx`/`append.test.tsx` inject a mocked `search` prop, so `Icd10SearchWidget`'s actual wiring to `icd10Api.search` was unverified by any automated test — evaluator closed the gap manually via a live proxy request, but that's evaluator-added evidence, not sprint-authored coverage. |

**Required fixes before closing:** none blocking. Non-blocking recommendation — add a test
exercising `icd10Api.search` itself — **closed same session**: added
`apps/web/src/api/__tests__/icd10.test.ts` (4 tests: URL/query-encoding, default limit, error
propagation). Writing it surfaced an unrelated, previously-invisible bug: Node 25's experimental
native `localStorage` global shadows jsdom's in this test environment, so `api/client.ts` and
`state/auth-context.tsx` had never actually been exercised by any test — `localStorage.setItem`
silently wasn't a function. Fixed with an in-memory `Storage` polyfill in
`apps/web/src/test/setup.ts`. Web suite now 21/21.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
