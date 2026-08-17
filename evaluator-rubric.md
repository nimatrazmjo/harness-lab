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

**Sprint:** `audit.trail` (the last Tier 1 item) · **Overall: PASS** (6/7 PASS, 1 CONDITIONAL,
closed same session)

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope:
`audit.service.ts` (filtering + provider-name join), `admin.mapper.ts`/`audit.mapper.ts` (new),
call sites added in `admin.service.ts` (create/deactivate) and `templates.controller.ts`
(create/update/delete), a new `GET /admin/audit-logs` route, `audit.ts` shared schema, and
`audit.e2e-spec.ts`. `notes.service.ts` (Tier 0's existing `note.save` logging) untouched.

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | PASS        | All 8 Done conditions reproduced live, independent of the test suite: provider create/deactivate each wrote the right audit row; template create/update/delete wrote 3 rows in the correct order with correct `target_id`; `GET /admin/audit-logs` returned newest-first with actor identity; the `action` filter and the `from`/`to` date-range filter (`?from=<tomorrow>` → 0 rows, `?from=<today>` → matches) both genuinely filter, not no-ops; non-admin got 403; a note saved with PHI-laden content left zero trace in `metadata` (only `{versionNumber}`); a provider created with a real password left zero trace of it in the raw `audit_logs.metadata` column, checked via psql. |
| 2   | Correctness           | PASS        | Live curl + direct `psql` against the real Postgres container throughout, not inferred from the test suite. |
| 3   | Invariants (§2)       | PASS        | SECRETS: confirmed via raw DB query, not API response shape, that no password or PHI ever reaches `metadata` across both the new admin-action logging and the pre-existing note-save logging. TENANT-ISOLATION: `GET /admin/audit-logs` sits under the same class-level `@Roles('admin')` gate as the rest of `AdminController`. PERSISTENCE: reuses the pre-existing `audit_logs` table and the shared `PG_POOL`, no new migration. Grepped for any `UPDATE`/`DELETE` on `audit_logs` — none exist; the contract's "append-only in spirit, not a formal AGENTS.md invariant for this table" framing was checked and found honest, not overclaimed. |
| 4   | Verification quality  | CONDITIONAL | The sprint's own verification plan claimed `audit.e2e-spec.ts` covered all Done conditions, but date-range filtering — an explicit Done condition — had no automated test, only the `action` filter did. The evaluator verified date-range filtering worked correctly live, so this was a coverage gap, not a bug. **Closed same session**: added a `filters by date range` test (8th test in the file). |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 76/76 at evaluation time (69 prior + 7 new), now 77/77 after the follow-up test. |
| 6   | Scope discipline      | PASS        | `git status` confined to audit call sites + new audit files + the test file; no changes to encounters, drafts, or any prior sprint's code. |
| 7   | Explainability        | PASS        | `@Global()` `AuditModule` correctly explains why no new module imports were needed; `LEFT JOIN providers` for `actorName` is the minimal-cost way to satisfy "actor identity"; metadata scoping (structural facts only, consistently applied across all 5 call sites) is a clean, defensible pattern. |

**Required fixes before closing:** none remaining — the one flagged gap (date-range filter test)
was closed in the same session, before this sprint was marked done.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
