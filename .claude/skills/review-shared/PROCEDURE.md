# Shared review procedure

Single source of truth for what `review-api`, `review-web`, `review-infra`, and `review-harness`
each do — every domain skill's `SKILL.md` is a thin file naming its scope and non-negotiables,
then pointing here for the actual steps. Change the procedure once, here; don't let four copies
drift.

## Why this exists, and how it relates to `/code-review`

`/code-review` already does general-purpose correctness/simplification review well — reuse it,
don't reinvent it. What it doesn't know is this repo's own conventions: root `AGENTS.md` §2's
invariants, `devops/AGENTS.md`'s non-negotiables, whether tracking docs (`feature-list.json`,
checklists, handoff files) actually reflect reality. That's the layer these four skills add. Each
review cycle is **two passes**, not one: `/code-review`'s generic pass, plus this domain's
harness-compliance pass (defined per-domain in each `SKILL.md`).

## The procedure

0. **Gate + orient.** Run the domain's own `init.sh`. Read its `session-handoff.md` and
   `feature-list.json` (the review-cycle log — see schema below). If invoked with nothing named
   and every tracked cycle is already in one of the three states that mean "nothing for an
   automated invocation to do" — `merged`, `no_issues_found`, or `awaiting_merge_approval`
   (done, correctly blocked on a human, not on this skill) — that's a clean no-op: report it and
   stop (loop-compatible, same discipline as `devops-request-grant`). Only `reviewing`/`fixing`/
   `re_reviewing` mean a cycle is actually mid-flight and needs resuming.

1. **Determine the target.** If the user named a PR/branch, use it. Otherwise look for the
   domain's own pending work: an un-PR'd branch touching its scope paths, or an open PR without
   a completed cycle logged. If nothing's pending, no-op.

2. **Append a `feature-list.json` entry** before touching anything — this file IS the audit
   trail for review cycles, same role `devops-request-grant/feature-list.json` plays for grants.
   Status `requested` if you're just logging pending work you've noticed but aren't starting on
   yet; status `reviewing` if you're beginning both passes immediately in the same session.

3. **Ensure the target is a real PR.** If the work isn't committed/pushed/PR'd yet, do that first
   (branch + PR per this repo's existing conventions — conventional commit message, PR body with
   a real summary and test plan). Never commit straight to `main`.

4. **Run `/code-review` against the PR** at an effort level matching the change's size (default
   `medium`; use `high` for anything touching invariants/non-negotiables). This is the generic
   correctness pass — don't hand-roll it.

5. **Run the domain's harness-compliance pass** (defined in that domain's `SKILL.md` — e.g. root
   `AGENTS.md` §2 invariants for api/web, `devops/AGENTS.md` non-negotiables for infra,
   internal-consistency checks for harness). Look specifically for things a generic reviewer
   wouldn't know to check.

6. **Comment on the PR** with both passes' findings combined, clearly labeled which pass found
   what. If nothing real turned up, say so plainly — don't manufacture findings to justify the
   cycle.

7. **Fix real issues, commit, push.** Flip the `feature-list.json` entry to `fixing` while this
   is happening.

8. **Re-review.** Re-run step 4 and 5 against the actual current state of the fixes.
   **Verify every fix against the real remote branch content — `git fetch` + inspect the pushed
   commit, or the GitHub API/`gh pr diff` — never trust local working-tree state alone.** This
   repo has already hit the exact failure mode of a review fork silently checking stale local
   duplicates instead of the real branch and reporting false re-flags — don't repeat it. If a
   fix doesn't hold up, go back to step 7.

9. **Stop before merging.** Flip the entry to `awaiting_merge_approval`, post a final PR comment
   summarizing what was found/fixed and that it's ready, and report back to whoever invoked this
   skill. **Do not run `gh pr merge` yourself** — this mirrors the existing devops-workstream
   convention (subagents never merge their own PRs) and was an explicit decision for these four
   skills specifically. A human merges; once they do (or tell you to), flip the entry to
   `merged`.

10. **Leave clean.** Run the domain's `cleanup.sh` (shared, see `review-shared/cleanup.sh`),
    overwrite `session-handoff.md`, prepend a dated `progress.md` entry, regenerate `graph.md`
    (`scripts/generate-feature-graph.py ... --relation blocks --target-field reviewedTarget`).

## `feature-list.json` schema (all four domains share this shape)

Each entry is one review cycle:

```json
{
  "id": "review-<domain>-YYYY-MM-DD-NN-<short-slug>",
  "status": "requested | reviewing | fixing | re_reviewing | awaiting_merge_approval | merged | no_issues_found",
  "title": "short human title",
  "description": "what's being reviewed and why",
  "prUrl": "https://github.com/.../pull/N",
  "reviewedTarget": "branch or PR identifier -- external-graph field, see scripts/generate-feature-graph.py --target-field",
  "codeReviewFindings": ["one-line summary per finding from the /code-review pass"],
  "harnessComplianceFindings": ["one-line summary per finding from the domain-specific pass"],
  "fixesApplied": ["one-line summary per fix, referencing the commit"],
  "rubric": "final evaluator-rubric.md verdict + evidence"
}
```

## Non-negotiables (all four domains)

- Never merge your own PR. Ever. No exceptions, no "but it's just docs."
- Never trust local working-tree state when verifying a fix landed — always check the real
  pushed branch.
- Never manufacture findings. A clean review with nothing to report is a valid, good outcome —
  say so, don't pad the comment to look thorough.
- Never touch another domain's no-touch zone (see each `SKILL.md`'s scope). If a fix genuinely
  requires crossing into another domain's files, stop and flag it rather than doing it silently.
