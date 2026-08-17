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

**Sprint:** `session.draft_persist, session.cross_device, edge.session_expired_save` ·
**Overall: PASS** (7/7 dimensions, no CONDITIONALs)

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope: new
`apps/api/src/drafts/{repository,service,controller,module}.ts`, small call-site diffs in
`notes.module.ts`/`notes.service.ts` (delete draft on real save) and `app.module.ts`, 3 new e2e
files, plus frontend wiring in `EncounterWorkspacePage.tsx` (restore-on-mount, debounced
autosave-on-edit, guarded against firing mid-SSE-stream) and the corresponding `api/client.ts`
(`put`) / `api/encounters.ts` additions.

| #   | Dimension             | Verdict | Evidence / why |
| --- | ---------------------- | ------- | -------------- |
| 1   | Contract fulfillment  | PASS    | All 7 Done conditions reproduced live, independent of the test suite: PUT/GET round-trip matched the raw `drafts` row byte-for-byte; fresh encounter returns `{note:null,updatedAt:null}`; two independent logins for the same provider (zero shared client state) saw the identical draft, and an edit from one was visible from the other on next fetch; a non-owning provider got 403 on both GET and PUT; a real save deleted the `drafts` row while leaving exactly one `note_versions` row; a garbage-token save attempt got 401, wrote zero versions, left the draft untouched, and a fresh login completed the save with matching content. |
| 2   | Correctness           | PASS    | Live curl + direct `psql` queries against the real Postgres instance, not inferred from tests. The frontend browser-reload claim itself was outside what the evaluator could re-run, but it traced the mechanism the claim depends on (`getDraft` on mount, debounced `saveDraft` guarded by the `generating` flag for the full SSE stream duration) and confirmed it's real, not aspirational. |
| 3   | Invariants (§2)       | PASS    | TENANT-ISOLATION: every draft call gated through `EncountersService.getForUser`, same pattern as the rest of the encounter surface. VERSION-IMMUTABILITY: draft deletion happens strictly after the `note_versions` INSERT, never touches it. Checked an adjacent risk not in the contract: a deactivated provider's draft rows stay fully intact (no cascade-delete), consistent with the prior sprint's data-preservation guarantee extending correctly to this new table. |
| 4   | Verification quality  | PASS    | Tests assert real content via direct DB queries, not just API response shape; `edge-expired-save.e2e-spec.ts` proves zero data loss end-to-end (failed save → 0 versions → intact draft → fresh login → completed save with matching content), not a shortcut assertion. |
| 5   | No regressions        | PASS    | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 69/69 (60 prior + 9 new), exact match. |
| 6   | Scope discipline      | PASS    | Diff limited to drafts wiring + minimal necessary call sites; no migration added (table pre-existed unused since Tier 0); no `audit.trail` or unrelated changes. |
| 7   | Explainability        | PASS    | Upsert-on-`encounter_id UNIQUE` is the correct primitive for one mutable draft row; the debounce-vs-SSE-streaming interaction was traced and confirmed correct, not just asserted. |

**Required fixes before closing:** none.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
