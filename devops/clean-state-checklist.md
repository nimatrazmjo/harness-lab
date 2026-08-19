# Clean-State Checklist — DevOps / CI-CD workstream

Two gates for the `devops/` workstream, mirroring the repo-root `clean-state-checklist.md`'s
role but scoped to infra: **no `/devops` session starts on a broken baseline, and none ends
without the tracking files reflecting reality.** Run _Start clean_ before touching anything in
this workstream; run _Leave clean_ before ending or handing off.

---

## A. Start clean — entry gate (before any new devops work)

**Environment & repo**

- [ ] On the intended branch and up to date: `git fetch`, `git status` shows a clean tree
- [ ] No stray uncommitted changes — or they're explained in `devops/session-handoff.md`
- [ ] `bash devops/init.sh` passes (toolchain present: docker/terraform/aws/trivy/gh, plus
      `devops/feature-list.json` parses as valid JSON). **This is a hard breakpoint, not just a
      checklist item** — the script itself refuses to exit 0 if resolved AWS credentials are the
      account root user; if it stops you here, replace the credentials before doing anything
      else in this workstream, including read-only exploration.

**Known-good baseline**

- [ ] Read `devops/session-handoff.md` + `devops/progress.md` + `devops/feature-list.json` — you
      know the next action and whether it's `blocked` on AWS access
- [ ] If the feature you're about to work needs real AWS and it's genuinely `blocked` on account
      access, don't fake it with mocked output — leave it `blocked` and say why

**If the baseline is RED**

- [ ] Do **not** build on it — fix the toolchain/baseline first, log what broke in
      `devops/progress.md`

---

## B. Leave clean — exit gate (before ending, or when context runs low)

**Code & state**

- [ ] Every `verify` command for the feature you touched was actually run — paste/summarize real
      output in `devops/progress.md`, not "should work"
- [ ] Work committed on a feature branch with a conventional message — or listed as in-flight in
      `devops/session-handoff.md`. **Never commit to `main`.**
- [ ] `terraform plan` shows no unexpected diff if any `.tf` file changed (drift check)

**No-touch zone + non-negotiables (devops/AGENTS.md)**

- [ ] Nothing under `apps/api/src/**`, `apps/web/src/**`, or `libs/**` was edited this session —
      if a devops item genuinely needed an app-code change, it was flagged in
      `devops/session-handoff.md`, not silently done
- [ ] No static AWS credential (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) introduced anywhere —
      auth is OIDC-only
- [ ] No image tagged or referenced as `latest` anywhere in a workflow, Dockerfile, or compose file
- [ ] No `terraform apply` run against real/shared state from a local machine (CI-only, once
      `devops.ci_terraform_plan` exists — until then, any local apply is logged explicitly in
      `devops/progress.md` with justification)
- [ ] No secret committed or staged — `git diff --cached` clean; `.tfvars`/`.env` files with real
      values stay git-ignored

**Harness bookkeeping**

- [ ] `devops/feature-list.json` statuses reflect reality (a feature is `passing` only if its
      `verify` commands actually succeeded against the real target)
- [ ] `devops/progress.md` has a new dated entry (what changed, real verify output, what's next)
- [ ] `devops/session-handoff.md` overwritten with the current snapshot and the single next action
- [ ] If any feature's `status` or `dependsOn` changed, regenerate `devops/graph.md`:
      `python3 scripts/generate-feature-graph.py devops/feature-list.json --out devops/graph.md --title "DevOps workstream — feature dependency graph"`

---

## Fast path

```bash
git fetch && git status                    # right branch, clean tree
bash devops/init.sh                        # toolchain + JSON gate
aws sts get-caller-identity                # confirm identity (and that it isn't root)
# ... work the feature, run its `verify` commands for real ...
git commit ...                             # on a branch, never main
# update devops/feature-list.json, devops/progress.md, devops/session-handoff.md
```
