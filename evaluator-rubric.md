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

**Sprint:** `admin.view_all, admin.roster, admin.templates_crud, admin.template_select,
admin.template_live_update` · **Overall: PASS** (1 dimension CONDITIONAL, non-blocking)

Evaluated 2026-08-17 by a fresh subagent with no authorship context. Diffed scope: new
`admin.service.ts`/`admin.mapper.ts`, admin CRUD routes added to `AdminController`, mixed
public/admin-guard routes added to `TemplatesController`, a `templateApplied` field threaded
through `libs/ai` so the mock model is genuinely template-aware, 5 new e2e test files, 3 new
`libs/ai` unit tests. Zero `apps/web` files touched (no admin UI — out of scope per the contract,
since every acceptance test for this cluster is backend-only).

| #   | Dimension             | Verdict     | Evidence / why |
| --- | ---------------------- | ----------- | -------------- |
| 1   | Contract fulfillment  | PASS        | All 8 Done conditions reproduced live or via direct test read: view-all spans providers + filters correctly; roster create/deactivate/list (live: create returns 201 with no password field, immediate login works); non-admin blocked on all 7 admin-gated routes (live: every one 403); template CRUD persists/404s correctly (live: 409 on dup email, 404 on missing template); output visibly differs by template (live: distinct Plan text per template, smuggled fake template ignored); live update takes effect with no caching bug (live: 4 sequential edits, each generation reflected the latest instantly). |
| 2   | Correctness           | PASS        | Full live curl session against the compiled API, independent of the test suite, reproducing every claim above by hand. |
| 3   | Invariants (§2)       | PASS        | TENANT-ISOLATION: admin bypass exclusively via `@Roles('admin')`; `RolesGuard` correctly mixes open-GET/admin-write on the same `TemplatesController`, verified live. SECRETS: provider creation hashes via `AuthService.hashPassword`, response DTO has no password field — confirmed empirically in the raw JSON. CONTEXT-INJECTION: template still loaded server-side only, no `@Body()` path to smuggle one client-side. |
| 4   | Verification quality  | PASS        | Tests assert real content, not shape-only: `template-apply.e2e-spec.ts` checks Plan differs between templates AND contains each template's specific instruction text AND excludes a smuggled fake name; `admin-roster.e2e-spec.ts` proves deactivation invalidates the *same already-issued* JWT, not merely blocking a fresh login. |
| 5   | No regressions        | PASS        | `pnpm run verify` → exit 0. `pnpm --filter api run test:e2e` → 60/60 (40 prior + 20 new). `pnpm --filter @scribe/ai run test` → 13/13 (10 prior + 3 new). |
| 6   | Scope discipline      | PASS        | `git diff --stat -- apps/web` empty — confirmed zero frontend files touched. No new migration (repositories were already built in Tier 0, unused until now). |
| 7   | Explainability        | CONDITIONAL | The mock's `templateApplied` string-concatenation (making an otherwise-inert mock observably template-aware) is honestly scoped and JSDoc'd as mock-only; `BedrockModelClient` never touches it (verified by grep — a real LLM would incorporate template guidance through genuine language understanding of `templateInstructions`, not string concatenation). Non-blocking residual risk: a future reader skimming only `mock-provider.ts` without the JSDoc could over-infer real generation works this way. No action required beyond the existing comments. |

**Required fixes before closing:** none.

**Only when Overall is PASS (or an accepted CONDITIONAL):** flip `feature-list.json` → `passing`,
then update `progress.md` and `session-handoff.md`.
