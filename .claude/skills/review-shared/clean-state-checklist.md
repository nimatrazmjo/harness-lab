# Shared Review-Skill Clean-State Checklist

Used by all four domain review skills. Run the **Start clean** gate before touching anything;
run the **Leave clean** gate before ending or handing off (i.e. before stopping at
`awaiting_merge_approval`).

## Start clean

- [ ] Domain `init.sh` exits 0.
- [ ] Read the domain's `session-handoff.md` and `feature-list.json` — know what's open before
      starting a new cycle.
- [ ] No `feature-list.json` entry stuck `reviewing`/`fixing`/`re_reviewing` from a prior session
      that never resolved. If one exists, resume it rather than starting a duplicate cycle for
      the same target.
- [ ] Confirm you're not about to review the same target another domain's skill is already
      mid-cycle on (check the other three domains' `feature-list.json` if the target is
      ambiguous, e.g. a PR touching both `apps/web` and `devops/`).

## Leave clean

- [ ] Every entry touched this cycle is in a terminal-for-this-session state
      (`awaiting_merge_approval`, `merged`, or `no_issues_found`) — never leave one at
      `reviewing`/`fixing`/`re_reviewing` across a session boundary without an explicit note in
      `session-handoff.md`.
- [ ] Shared `cleanup.sh` run.
- [ ] `session-handoff.md` overwritten, `progress.md` has a new dated entry.
- [ ] `graph.md` regenerated if any entry's `status`/`reviewedTarget` changed.
- [ ] **The PR was NOT merged.** Confirm this explicitly — it's the one gate that must never be
      silently skipped in the other direction.
