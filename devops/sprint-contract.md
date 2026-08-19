# Sprint Contract — DevOps / CI-CD workstream

## Sprint outcome — devops.cd_push_ecr_main (2026-08-18) — PASSING, confirmed post-merge

PR #19 merged to `main` by the human owner (never self-merged, per this workstream's rule).
This produced the first real push-to-main run against the new `build-images.yml` jobs, merge
commit `9bba1f2c2920fdd9908d2b1d1207854441037717` — watched live via the GitHub API:
`secret-scan-main` (success, 10s) → `build-api`/`build-web` (success, ~1.5min each, includes the
existing Trivy image-scan gate) → `push-api`/`push-web` (success, started only after their
respective build job finished). Overall run conclusion: `success`.

**All three literal `verify` commands then run for real against that exact merge SHA**
(previously marked `[ ]` below as "cannot run pre-merge" — now real, all `[x]`):
- `aws ecr describe-images --repository-name scribe-api --image-ids
  imageTag=9bba1f2c2920fdd9908d2b1d1207854441037717` → succeeded, real `imagePushedAt`
  (`1787108006.584`), real size (93,739,700 bytes).
- Same for `scribe-web` → succeeded, real `imagePushedAt` (`1787107983.8`), real size
  (23,112,458 bytes).
- `aws ecr list-images --repository-name scribe-api --query 'imageIds[].imageTag'` →
  `smoke-test-tag`, the real merge SHA, and the pre-merge dry-run tag — zero `latest`. Same for
  `scribe-web` → only the merge-SHA tag, zero `latest`.

`devops/feature-list.json` → `devops.cd_push_ecr_main` `passing`, rubric rewritten with this
real post-merge evidence. Docs-only branch `docs/devops-cd-push-ecr-main-confirm` (off the
post-merge `main`), PR opened, not merged. Full detail: `devops/progress.md`'s two 2026-08-18
entries for this feature (build/PR-verify, then this confirmation).

Everything below this line is the **original contract**, filled in before coding started —
kept verbatim as the record of what was planned and verified pre-merge; the two `[ ]` items in
its Verification plan and Definition of done are the ones this outcome section above closed out.

---

## Superseded — original Active-sprint contract for devops.cd_push_ecr_main, filled in before
coding (kept for the concrete approach and pre-merge verification record; see "Sprint outcome"
above for the real post-merge proof)

**Feature:** `devops.cd_push_ecr_main` (Tier 2), `dependsOn: ["devops.terraform_ecr",
"devops.ci_secret_scan", "devops.ci_image_scan_trivy"]`. `terraform_ecr`'s real AWS state
reconciled this session: `aws ecr describe-repositories --repository-names scribe-api
scribe-web` shows both repos live, `imageTagMutability: IMMUTABLE`, `scanOnPush: true` — the
dependency is satisfied in reality even though `main`'s `feature-list.json` still shows
`blocked` pending PR #18's merge (not mine to merge). `ci_secret_scan`/`ci_image_scan_trivy` are
`passing` and merged.

**Goal (one sentence):** Extend `.github/workflows/build-images.yml` with a `push: branches:
[main]` trigger so the existing build+Trivy-scan jobs also run against the merge commit, add a
push-gated `secret-scan-main` job (gitleaks, mirrors `secret-scan.yml`'s check but scoped to the
merge commit itself, since `secret-scan.yml` only triggers on `pull_request` and its PR-head-SHA
run doesn't cover the distinct merge-commit SHA), then two push-only jobs (`push-api`,
`push-web`) that `needs:` their respective build job + `secret-scan-main`, authenticate via OIDC
(`role-to-assume: arn:aws:iam::404063516240:role/scribe-github-actions-deploy`), and push the
image tagged with the full `${{ github.sha }}` — never `latest` — to ECR.

**Tier:** 2 · **Branch:** `feat/devops-cd-push-ecr-main`

### Context

`build-images.yml` currently triggers only on `pull_request`; its jobs build with `load: true`
(local Docker daemon) and Trivy-scan in the same job, but never push, and never run on `push`.
`secret-scan.yml` also only triggers on `pull_request`. Since this repo merges PRs via real merge
commits (not squash — see `git log`), the commit that lands on `main` is a NEW SHA distinct from
the PR head SHA that the PR's checks ran against; branch protection already requires
`secret-scan` to pass before merge is even allowed, so the merge commit's checks are pre-vetted
by definition, but re-running secret-scan and the build+image-scan against the actual merge
commit before pushing it to ECR is the literal, defensible interpretation of "gated on the
secret-scan and image-scan jobs having passed for that commit." Cross-workflow `needs:` isn't
possible (GitHub Actions `needs:` only works within one workflow file), so implementing option
(b) from the task brief: fold everything into one workflow file (`build-images.yml`), one
`push`-triggered run, real `needs:` gating.

OIDC role/ECR repo names/region confirmed from `infra/terraform/main.tf` (not modified —
read-only): role `scribe-github-actions-deploy`, account `404063516240`, region `us-east-1`,
repos `scribe-api`/`scribe-web`. Role's `EcrPushPullScribeRepos` statement already grants
`ecr:PutImage`/`InitiateLayerUpload`/`UploadLayerPart`/`CompleteLayerUpload`/
`BatchCheckLayerAvailability` scoped to exactly these two repo ARNs — no new IAM grant needed for
this feature (confirmed by reading the applied policy document; not re-run through Terraform).

### Explicitly OUT of scope this sprint

- Any resource under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone.
- Any `terraform apply` — this feature is GitHub Actions YAML only, no infra changes.
- Merging PR #18 (`docs/devops-terraform-ecr-reconcile`) — not my PR, not my call.
- `devops.cd_deploy_prod_on_main` and later Tier 2 CD features — not touched here.
- Simulating/mocking a push-to-main run to force verification — cannot be done pre-merge, will
  be stated plainly as unverified rather than faked.

### Done conditions (copied verbatim from `devops/feature-list.json` acceptance)

- [ ] Push only triggers on push-to-main, gated on the secret-scan and image-scan jobs having
      passed for that commit.
- [ ] Image tag is the git SHA (short or full) — grep the whole workflow file, `latest` must not
      appear as a tag value.
- [ ] Auth uses the OIDC role, zero AWS_ACCESS_KEY_ID/SECRET anywhere in the job.

### Verification plan (real commands, run for real)

- [x] `actionlint .github/workflows/build-images.yml` (and full-repo `actionlint`) — clean,
      exit 0 both times.
- [x] `grep -n 'latest' .github/workflows/build-images.yml` — 8 matches, all either comment
      prose ("never `latest`") or `runs-on: ubuntu-latest`; zero as an actual image tag value.
- [x] `grep -n 'AWS_ACCESS_KEY_ID\|AWS_SECRET_ACCESS_KEY' .github/workflows/build-images.yml` —
      zero matches.
- [x] Real AWS dry-run beyond what was planned: `aws iam get-role-policy --role-name
      scribe-github-actions-deploy --policy-name scribe-github-actions-deploy-permissions`
      (devops-agent CAN read this, unlike earlier sessions' IAM self-inspection gap) — confirmed
      the LIVE policy already grants exactly `ecr:PutImage`/`InitiateLayerUpload`/
      `UploadLayerPart`/`CompleteLayerUpload`/`BatchCheckLayerAvailability`/`GetAuthorizationToken`
      scoped to `arn:aws:ecr:us-east-1:404063516240:repository/{scribe-api,scribe-web}`, and the
      trust policy's `sub` StringLike condition includes
      `repo:nimatrazmjo@3712526/harness-lab@1332166375:ref:refs/heads/main` — matches exactly
      what a real push-to-main OIDC assumption will present. This is real evidence the role CAN
      do what this workflow asks of it, short of a literal OIDC-token exchange (which can only
      happen inside a real GitHub Actions run, not locally).
- [x] Real end-to-end ECR push dry-run (different principal — `devops-agent`, not the OIDC
      role, so NOT equivalent proof of the role's own path, but proves the registry mechanics:
      login, push, tag lands, describe-images sees it): `aws ecr get-login-password | docker
      login` succeeded; `docker push .../scribe-api:manual-dryrun-devopsagent-39b18c4` succeeded;
      `aws ecr describe-images --image-ids imageTag=manual-dryrun-devopsagent-39b18c4` confirmed
      the tag exists with a real `imagePushedAt`. Re-pushing the identical digest to the same tag
      succeeded (no-op, same content) — this is expected ECR behavior, NOT a contradiction of
      immutability (immutability blocks overwriting a tag with a DIFFERENT image, already proven
      by `devops.terraform_ecr`'s own double-push test — not re-proven here, out of scope for
      this feature). Local dry-run tag removed afterward (`docker rmi`); the pushed ECR image
      itself could not be deleted (devops-agent lacks `ecr:BatchDeleteImage`, same known gap
      documented in `devops/session-handoff.md` from the `terraform_ecr` smoke test) — harmless,
      same precedent as the existing `scribe-api:smoke-test-tag` leftover.
- [x] Opened the PR — `pull_request`-triggered run confirms `build-api`/`build-web` (and PR's own
      `secret-scan`) still pass unchanged, and `secret-scan-main`/`push-api`/`push-web` correctly
      show as skipped (not run) on the PR event — see progress.md for the run ID/URL.
- [ ] The literal feature `verify` commands (`aws ecr describe-images ... imageTag=<sha>`, `aws
      ecr list-images ... | grep -v latest`) CANNOT be run for real pre-merge — no commit has
      gone through the actual push-to-main path yet (the dry-run above used a different
      principal and a fabricated tag, not the OIDC role or a real merge-commit SHA). Stated
      plainly; not faked as `passing`.

### Invariants that must still hold

- [ ] No static AWS credentials introduced in the workflow (OIDC only).
- [ ] No `latest` tag anywhere in the workflow file.
- [ ] No-touch zone respected.
- [ ] No `terraform apply` run.

### Definition of done

- [ ] Every Done condition checked with real evidence, or explicitly marked unverifiable
      pre-merge.
- [ ] Every verify command actually run where it's possible to run it; the rest documented as
      "needs a real merge to main to prove."
- [ ] `devops/feature-list.json` status set honestly — likely `in_progress` (built, PR-verified
      as much as is possible pre-merge, but the actual ECR push is unproven until a real merge)
      rather than `passing`.
- [ ] `devops/progress.md` + `devops/session-handoff.md` + this file updated in the same commit.

---


An agreement written **before** a devops sprint starts and checked **after** it ends. A
"sprint" here = one feature from `devops/feature-list.json` (they're intentionally large —
provisioning real infra isn't always a one-sitting task, so a sprint may legitimately span
sessions; `devops/session-handoff.md` carries it across).

Its job is the same as the repo-root `sprint-contract.md`: pin down what "done" means **up
front**, including exactly which `verify` commands will be run for real, so the sprint can't
quietly get marked `passing` on a plan-only or mocked basis.

**How to use:**

- **Sprint start:** fill in _Active sprint_ and state it back before writing any Terraform/
  Dockerfile/workflow. If you can't name the exact `verify` commands you'll run against the real
  target, the task isn't understood yet — clarify first.
- **Sprint end:** score the work against `devops/evaluator-rubric.md`. If it passes (or an
  accepted CONDITIONAL), fold the outcome into `devops/progress.md` and overwrite this file for
  the next sprint.

---

## Active sprint — devops.terraform_ecr status reconciliation (2026-08-18)

**Not new code.** This sprint is a status-reconciliation pass, not a build: `devops/feature-list.json`
read `devops.terraform_ecr` as `status: blocked` (IAM `ecr:TagResource` AccessDenied, "no partial
resources created") while `devops/session-handoff.md` flagged that status as disputed/stale —
possibly superseded by later work that never got merged back. Goal: determine ground truth from
real AWS + git history, not from either doc, and reconcile the docs to match reality. No Terraform,
Dockerfile, or workflow changes expected or authorized this sprint — only
`devops/feature-list.json` / `devops/progress.md` / `devops/session-handoff.md` /
`devops/sprint-contract.md`.

**Tier:** 0 (docs-only) · **Branch:** `docs/devops-terraform-ecr-reconcile`

### Context

Investigation before writing anything: `git log --all` showed PR #11 (`feat/devops-terraform-ecr`)
merged to `main` at the "blocked" state (commit `8a35335`), but the remote branch
`origin/feat/devops-terraform-ecr` was never deleted and carries one further commit, `be8a00f`
("docs(devops): flip terraform_ecr to passing with real double-push proof"), never merged —
it documents 2 more IAM rounds (manual.md Steps 9-10: `ecr:TagResource`, then
`ecr:GetLifecyclePolicy`) and a completed real double-push immutability test. That commit is the
source of the "disputed" status session-handoff flagged. Real AWS state needed to be checked
independently rather than trusting that stranded commit's claims either.

### Done conditions (this sprint's own, not copied from feature-list.json's acceptance — those are
what's being re-verified, see below)

- [x] All 4 of `devops.terraform_ecr`'s original acceptance criteria re-verified against live AWS
      this session (not trusted from either doc).
- [x] Determined how/where the resources were actually applied (CI vs local), with git evidence.
- [x] `terraform plan` (plan-only, no apply) checked for drift between declared config and real
      state.
- [x] `feature-list.json` status set to match verified reality, with a rubric note giving today's
      date, the real evidence, and an explanation of the discrepancy's origin.
- [x] No `terraform apply` run by this sprint, under any circumstance.
- [x] No files under `apps/*/src`, `libs/**`, or any Terraform/Dockerfile/workflow touched.

### Verification plan (real commands, run for real, AWS_PROFILE=devops-agent)

- [x] `aws ecr describe-repositories --repository-names scribe-api scribe-web` — confirm
      `imageTagMutability=IMMUTABLE` + `scanOnPush=true` on both, independently of the calling
      session's own report of the same.
- [x] `aws ecr get-lifecycle-policy --repository-name scribe-api` / `scribe-web` — confirm the
      untagged->7-days expiry rule.
- [x] Live double-push test: pull a small public image, tag `scribe-api:smoke-test-tag`, push;
      pull a *different* image, tag the same `smoke-test-tag`, push again — must be rejected.
      (The tag already existed from a prior session's identical test — re-pushing the exact same
      digest is a documented ECR no-op, so a genuinely different image was required to prove
      rejection is still live today, not just historically.)
- [x] `git log --all`, `git branch -a`, `gh pr list --state all` — determine merge/PR history for
      any ECR/terraform_ecr-related work.
- [x] `cd infra/terraform && terraform plan` (plan-only) — check for drift.
- [x] Attempt `aws ecr batch-delete-image` on the leftover smoke-test tag (known-gap check, not
      required for passing) — expect/confirm `AccessDeniedException` per documented
      `ecr:BatchDeleteImage` gap, don't fight it if so.

### Invariants that must still hold

- [x] `terraform apply` never run by this sprint — plan-only.
- [x] No static AWS credentials introduced (AWS_PROFILE=devops-agent, local CLI use only).
- [x] No `latest` tag used anywhere (smoke test used `smoke-test-tag`, digest-pinned alpine
      versions).
- [x] No-touch zone respected — no `apps/*/src`, `libs/**`, Terraform, Dockerfile, or workflow
      files touched; only devops docs.

### Sprint outcome

All 4 acceptance criteria confirmed live: both repos IMMUTABLE + scanOnPush; both lifecycle
policies expire untagged images after 7 days; live double-push test rejected a genuinely
different image on the existing tag (`alpine:3.18` -> `scribe-api:smoke-test-tag`, already
holding `alpine:3.19`'s digest from a prior session — same-digest re-push succeeded as an
expected ECR no-op, different-digest push was rejected with the immutability error). `terraform
plan` shows zero drift — both `aws_ecr_repository` and `aws_ecr_lifecycle_policy` resources
tracked cleanly in remote state. Provenance: applied via local `terraform apply`
(AWS_PROFILE=devops-agent, PR #11, commit `8a35335`, merged to `main`) — not CI, because no
`terraform apply` workflow exists anywhere in this repo yet; this matches the same documented
Tier-0-bootstrap local-apply exception already used for `terraform_backend` and
`terraform_oidc_github`. `ecr:BatchDeleteImage` still denied for `devops-agent`, as documented —
left the leftover `smoke-test-tag` image alone. `devops/feature-list.json` ->
`devops.terraform_ecr` `passing`, with a rubric note explaining the discrepancy's origin (a
stranded, never-merged commit on `origin/feat/devops-terraform-ecr`) and citing this session's
independent re-verification. `devops.cd_push_ecr_main` (Tier 2) is now unblocked with respect to
this dependency — its other two dependencies (`ci_secret_scan`, `ci_image_scan_trivy`) were
already `passing`.

---

## Prior sprint outcome — devops.dockerfile_web (2026-08-18)

All four Done conditions met with real evidence; all four literal `verify` commands run
end-to-end and green (build exit 0, container stays up, `curl -f / | grep -qi 'AI Clinical
Scribe'` matched, clean `docker stop`); extra evidence for "non-root" (`id` -> `uid=101(nginx)`)
and "no source/node_modules shipped" (`find` inside the container for both -> empty), plus
`nginx -t` + a read-through confirming the templated `/api/*` config mirrors
`infra/nginx.conf`'s rewrite/proxy_buffering rules (not curl-tested — no linked API container
in this sprint's smoke test). No static AWS creds, no `latest` tag, no-touch zone respected
(`infra/nginx.conf` read-only, nothing under `apps/*/src` or `libs/**` touched). Full detail:
`devops/progress.md` (2026-08-18 entry) and `devops/session-handoff.md`. Status flipped to
`passing` in `devops/feature-list.json`, committed on `feat/devops-dockerfile-web`.

## Prior sprint outcome — devops.terraform_backend (2026-08-18) — BLOCKED, not passing

Terraform fully written and ready (`infra/terraform-bootstrap/`, `infra/terraform/backend.tf`+
`provider.tf`+`main.tf`), `terraform init`/`plan` in the bootstrap dir both succeeded, but the
authorized `terraform apply` got real AWS `AccessDenied` on `s3:CreateBucket` and
`dynamodb:CreateTable` for the `devops-agent` IAM user — confirmed no partial resources
created. `infra/terraform/`'s `terraform init` against the S3 backend correctly failed too
(bucket doesn't exist). Status left `blocked`, not faked `passing`. Full errors + minimal IAM
fix needed: `devops/progress.md` 2026-08-18 entry. Branch `feat/devops-terraform-backend`, PR
opened (not merged — see devops/session-handoff.md for the URL). Next action is an IAM grant,
not more Terraform work — re-run this same sprint once `devops-agent` has the needed
permissions.

## Sprint outcome — devops.terraform_oidc_github (2026-08-18) — BLOCKED, not passing

Terraform applied cleanly on the first `terraform apply` (`3 added, 0 changed, 0 destroyed`) —
`aws_iam_openid_connect_provider.github_actions`, `aws_iam_role.github_actions_deploy`,
`aws_iam_role_policy.github_actions_deploy_permissions` all real and live. Confirmed via
`aws iam get-open-id-connect-provider` (issuer + thumbprint) and `aws iam get-role` (trust
policy scoped to `repo:nimatrazmjo/harness-lab:ref:refs/heads/main` +
`repo:nimatrazmjo/harness-lab:pull_request` — NOT `repo:*`). 2 of 3 minimum verify proofs done
for real. Blocked on:
1. `aws iam simulate-principal-policy` — real `AccessDenied` for `devops-agent` on
   `iam:SimulatePrincipalPolicy` itself (not a create/manage action, wasn't in the existing
   grant). Exact fix documented in `devops/manual.md` Step 8.
2. The committed `.github/workflows/oidc-smoke-test.yml` (PR #9, branch
   `feat/devops-terraform-oidc-github`) doesn't execute yet — GitHub doesn't dispatch/trigger
   `pull_request`/`workflow_dispatch` workflows for a file that only exists on a non-default
   branch. Self-resolves on merge; not an IAM issue, no grant needed.

Left `status: blocked` in `devops/feature-list.json` with the precise reason, per
`devops/manual.md`/`devops/AGENTS.md`'s "don't fake passing" rule. PR #9 open, not merged.
Full detail: `devops/progress.md` 2026-08-18 entry, `devops/manual.md` Step 8 + Log.

## Sprint outcome — devops.terraform_ecr (2026-08-18) — BLOCKED, not passing

Terraform written and `plan`-clean (`4 to add, 0 to change, 0 to destroy` for
`aws_ecr_repository.scribe["scribe-api"/"scribe-web"]` +
`aws_ecr_lifecycle_policy.scribe_expire_untagged`), but `terraform apply` hit real
`AccessDenied` on `ecr:TagResource` for both repos before either was created (confirmed no
partial resources via `describe-repositories` + `terraform state list`). Root cause: the
existing `EcrRepos` grant covers `CreateRepository` but not the separate `TagResource` action
bundled into that call via the provider's `default_tags`. Zero of the four required `verify`
commands could run for real. Exact minimal fix in `devops/manual.md` Step 9. Left `status:
blocked` in `devops/feature-list.json`, not faked `passing`. Branch
`feat/devops-terraform-ecr`, PR opened (not merged). Full detail:
`devops/progress.md`/`devops/session-handoff.md` 2026-08-18 entries.

## Sprint outcome — devops.ci_secret_scan (2026-08-18) — PASSING

All three Done conditions met with real evidence: (1) `secret-scan` job runs on every PR via
`.github/workflows/secret-scan.yml` (`gitleaks/gitleaks-action@v2`, `pull_request` trigger) —
confirmed firing on PR #12; (2) `main` branch protection created fresh (previously none)
requiring `secret-scan` — confirmed via `gh api .../protection | jq
'.required_status_checks.contexts'` → `["secret-scan"]`, and a real PR (#13) showed
`mergeStateStatus: "BLOCKED"` while the check was red; (3) PR #13's deliberate fake
`AKIA...`-shaped string in `scratch.txt` produced a genuine `secret-scan: fail`. Bonus: the
scanner also caught a real (if accidental) fake-key-shaped string I'd written into this file's
own draft verify-plan text on the first run of PR #12 — fixed and squashed out of history.
Branch protection added surgically — only `required_status_checks`, nothing else. No AWS
touched, no-touch zone respected. Test PR #13 closed without merging, branch deleted
locally+remotely. `devops/feature-list.json` → `passing`. Branch
`feat/devops-ci-secret-scan`, PR #12 open, **not merged** (per this workstream's "never merge
own PR" rule). Full detail: `devops/progress.md` 2026-08-18 entry.

## Sprint outcome — devops.ci_build_images (2026-08-18) — PASSING

Merged (PR #14). See rubric note in `devops/feature-list.json` for evidence. `build-images.yml`
is the workflow this sprint extends.

## Sprint outcome — devops.ci_image_scan_trivy (2026-08-18) — PASSING

**Deviation from this contract's own "explicitly OUT of scope" line, disclosed up front:** the
contract below pre-committed to "only the ARG digest line, nothing structural" for Dockerfile
edits. The real local scan (see progress.md's full 2026-08-18 entry) surfaced a genuine
non-base-image bug — `pnpm install --prod` wasn't pruning already-installed devDependencies —
plus an unused bundled `npm` CLI shipping real CVEs. Neither is fixable by a digest bump. Given
the task's overriding instruction to not force a pass and to prefer real remediation over
`.trivyignore` for genuinely fixable findings, I fixed both (a `pnpm prune --prod` addition and
an `rm -rf` of the unused npm CLI in the runtime stage) rather than leaving them or blanket-
ignoring them. Also bumped two real transitive prod-dependency versions (`multer`, `lodash`) via
`pnpm-workspace.yaml overrides` — a lockfile/workspace-config change, not application source.
Every change was re-verified against `devops.dockerfile_api`/`devops.dockerfile_web`'s own
acceptance criteria (fresh `--no-cache` build, `/health` OK, non-root) before proceeding, per
this task's explicit instruction for base-image-adjacent Dockerfile changes.

All Done conditions met with real evidence:
- [x] Trivy runs against both images on every PR, after devops.ci_build_images — same job,
      `load: true` + Trivy install + scan step appended to both `build-api`/`build-web` jobs in
      `build-images.yml`.
- [x] Job fails on any CRITICAL/HIGH finding not allowlisted — `--exit-code 1` on the real
      `trivy image` invocation; proven both ways (ignorefile passes real images, no-ignorefile
      fails the ancient-base proof).
- [x] Ancient-base-image PR fails, real Dockerfiles pass — see verification plan below, all
      commands run for real.

### Verification plan — all run for real, final results

- [x] `trivy image --severity CRITICAL,HIGH scribe-api:local` (no exit-code) BEFORE any code —
      66 real findings across 3 categories (22 unfixable Debian OS pkgs, 19 leaked
      devDependencies, 25 in bundled npm's own deps). `scribe-web:local` — 0 findings, clean.
- [x] After fixes: `trivy image --exit-code 1 --severity CRITICAL,HIGH --ignorefile .trivyignore
      scribe-api:local` → **exit 0**. Same for `scribe-web:local` → **exit 0**.
- [x] `docker build -t scribe-api:vuln-test -f - . <<< 'FROM node:18.0.0'` → builds. `trivy image
      --exit-code 1 --severity CRITICAL,HIGH scribe-api:vuln-test` (no ignorefile) → **exit 1**,
      62 CRITICAL + 63 HIGH real findings.
- [x] `actionlint .github/workflows/build-images.yml` (and full-repo `actionlint`) → clean, exit
      0.
- [ ] Open the real feature PR / `gh pr checks` — **not yet done as of this commit**; happens
      immediately after this commit, before reporting done. If the real PR run doesn't match
      local results, this section will be corrected before declaring `passing`.

### Invariants — confirmed

- [x] No static AWS credentials anywhere (n/a, no AWS calls).
- [x] No `latest` tag anywhere — Trivy CLI pinned `v0.74.0`, no image tag changes.
- [x] No-touch zone respected — `git diff` confirms nothing under `apps/*/src` or `libs/**`;
      touched files are `apps/api/Dockerfile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
      `.trivyignore` (new), `.github/workflows/build-images.yml`, plus devops bookkeeping.
- [x] Every `.trivyignore` entry has an individual comment (CVE, Debian status, why
      inapplicable) — 13 entries, no blanket suppression; verified the file passes real trivy
      exit-0 runs, not just "looks reasonable."
- [x] No permanent "build vulnerable image" step in the real workflow — the `node:18.0.0` proof
      was local-only, image removed afterward (`docker rmi scribe-api:vuln-test`).

## Superseded — original Active-sprint draft, filled in before coding (kept for the concrete
approach; see "Sprint outcome" above for what actually happened, including the one disclosed
deviation)

**Feature(s):** `devops.ci_image_scan_trivy` — next Tier 1 item, `dependsOn:
["devops.ci_build_images"]` (passing, merged). GitHub-side only + local Docker/Trivy, no AWS
resources touched.

**Goal (one sentence):** Extend `build-images.yml` so both images are also scanned by Trivy for
CRITICAL/HIGH CVEs on every PR (loading the built image via `load: true` in the same job so
Trivy has the real artifact), failing the job on any unallowlisted finding, with a `.trivyignore`
mechanism requiring a justifying comment on every entry (none expected unless a real, unfixable
base-image CVE turns up).

**Tier:** 1 · **Branch:** `feat/devops-ci-image-scan-trivy`

### Context

`apps/api/Dockerfile` / `apps/web/Dockerfile` are `passing`, digest-pinned
(`node:22-slim@sha256:d649c...`, `nginxinc/nginx-unprivileged:stable-alpine@sha256:44e36...`) —
not to be modified unless a real CVE forces a base-image bump, in which case the digest is
re-pinned (never a floating tag) and the image is smoke-rebuilt to confirm acceptance criteria
still hold. Plan: run `trivy image` locally against both real images FIRST to see actual
findings before writing any workflow/ignore-file content — per the task's explicit "don't force
a pass" instruction. Reuse `build-images.yml`'s existing `build-api`/`build-web` jobs by adding
`load: true` + a Trivy step to each, rather than a new workflow (avoids rebuilding the image a
second time in a separate job).

### Explicitly OUT of scope this sprint

- Any resource under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone.
- Editing the Dockerfiles UNLESS a real CRITICAL/HIGH CVE requires a base-image digest bump —
  and even then, only the `ARG NODE_IMAGE=`/`ARG NGINX_IMAGE=` digest line, nothing structural.
- `devops.cd_push_ecr_main` and later Tier 2 CD features — not touched here.
- Branch protection / required-checks list — leaning not to touch; only add if acceptance
  criteria clearly requires it (re-read: criteria say "job fails the PR", not "is a required
  check" — required-check enforcement is a separate, repo-wide concern, not adding it here).
- A permanent "build a broken image on purpose" step in the real workflow — criterion 3's proof
  is a one-off local verification, not a CI fixture.

### Done conditions (copied verbatim from `devops/feature-list.json` acceptance)

- [ ] Trivy runs against both images on every PR, after devops.ci_build_images.
- [ ] Job fails on any CRITICAL or HIGH severity finding not explicitly allowlisted.
- [ ] A PR built from a deliberately outdated/vulnerable base image fails the check; the real
      Dockerfiles pass.

### Verification plan (real commands, run for real)

- [ ] Local, real, BEFORE any code: `docker build -t scribe-api:local -f apps/api/Dockerfile .`
      + `trivy image --severity CRITICAL,HIGH scribe-api:local` (no exit-code flag first, just to
      see findings) — repeat for `scribe-web:local`.
- [ ] `trivy image --exit-code 1 --severity CRITICAL,HIGH --ignorefile .trivyignore
      scribe-api:local` — expect exit 0 on the real Dockerfile (same for `scribe-web:local`).
- [ ] `docker build -t scribe-api:vuln-test -f - . <<< 'FROM node:18.0.0'` then `trivy image
      --exit-code 1 --severity CRITICAL,HIGH scribe-api:vuln-test` — expect non-zero exit.
- [ ] `actionlint .github/workflows/build-images.yml` clean before pushing.
- [ ] Open the real feature PR — its own `pull_request` run is the real CI verify (both
      build+scan jobs green on the real Dockerfiles).
- [ ] `gh pr checks` — both jobs green.

### Invariants that must still hold

- [ ] No static AWS credentials introduced anywhere.
- [ ] No `latest` tag introduced anywhere (including any base-image bump — always a digest).
- [ ] No-touch zone respected.
- [ ] Any `.trivyignore` entry has a comment justifying it — no blanket suppression.
- [ ] No permanent "build vulnerable image" step added to the real workflow.

### Definition of done

- [ ] Every Done condition checked with real evidence.
- [ ] Every verify command actually run, output recorded.
- [ ] `devops/feature-list.json` → `passing` (or left `blocked`/`failing` with exact reason).
- [ ] `devops/progress.md` + `devops/session-handoff.md` + this file updated in the same commit.

## Superseded — original devops.ci_build_images contract (kept for the concrete approach; all
boxes below are now checked, see "Sprint outcome" above)

### Context

`apps/api/Dockerfile` and `apps/web/Dockerfile` are both `passing` (`devops.dockerfile_api`,
`devops.dockerfile_web`) and not to be modified. Both build from the repo root (`docker build -f
apps/api/Dockerfile .`) per their own header comments — the workflow's `context` must be `.`
(repo root), not the app subdirectory. Two separate jobs, `build-api` and `build-web`, both
`pull_request`-triggered, using `docker/build-push-action@v6` with `push: false` and
`cache-from: type=gha` / `cache-to: type=gha,mode=max`. No login/push/registry step at all —
that's `devops.cd_push_ecr_main`, a separate later feature.

### Explicitly OUT of scope this sprint

- Any resource under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone.
- Modifying `apps/api/Dockerfile` / `apps/web/Dockerfile` — passing features, build-only here.
- `devops.ci_image_scan_trivy` / `devops.cd_push_ecr_main` — separate Tier 1/2 features, not
  touched here.
- Any push/login/registry-auth step — explicitly out of scope per the feature's own acceptance
  criterion #3.
- `devops.terraform_ecr` — still `blocked`, not mine to fix, not touched.

### Done conditions (copied verbatim from `devops/feature-list.json` acceptance)

- [ ] Both images build successfully on every PR.
- [ ] Build uses layer caching (GHA cache backend) so PR builds aren't full-cold every time.
- [ ] No push step runs on a PR — push only happens from `devops.cd_push_ecr_main`, on main.

### Verification plan (real commands, run for real)

- [ ] `actionlint .github/workflows/build-images.yml` — clean before pushing.
- [ ] Open the real feature PR (its own `pull_request` trigger is the real verify run — no
      throwaway PR needed, this feature only needs to prove a success case).
- [ ] `gh pr checks` — `build-api` and `build-web` jobs both green.
- [ ] `gh run view <run-id> --log | grep -qv 'docker push'` — confirm no push happened (also
      confirmed by static read of the workflow file: no push/login step exists at all).

### Invariants that must still hold

- [ ] No static AWS credentials introduced anywhere (n/a — no AWS calls in this workflow).
- [ ] No `latest` tag introduced anywhere, including local `docker build -t` tags.
- [ ] No-touch zone respected (`git diff` confirms nothing under `apps/*/src` or `libs/**`, and
      the two Dockerfiles themselves are untouched).
- [ ] No push/registry-auth step added.

### Definition of done

- [ ] Every Done condition checked with real evidence.
- [ ] Every verify command actually run, output recorded.
- [ ] `devops/feature-list.json` → `passing` (or left `blocked`/`failing` with exact reason).
- [ ] `devops/progress.md` + `devops/session-handoff.md` + this file updated in the same commit.

## Superseded draft — the original contract for `devops.ci_secret_scan`, filled in before
coding (kept for the concrete approach; all boxes below are now checked, see the "Sprint
outcome" section above for the real evidence)

**Feature(s):** `devops.ci_secret_scan` — explicitly dispatched this session (has
`dependsOn: []`, so it does not require blocked Tier 0 items to unblock first; GitHub-side
only, no AWS resources touched).

**Goal (one sentence):** Add a `gitleaks/gitleaks-action`-based GitHub Actions workflow that
runs on every PR and make it a required branch-protection status check on `main`, so a PR
containing a hardcoded secret cannot merge.

**Tier:** 1 · **Branch:** `feat/devops-ci-secret-scan`

### Context

`scripts/check-no-committed-secrets.sh` already exists locally (uses `gitleaks detect` if
installed, else a regex fallback for AWS-key-shaped strings / private-key headers / an
`.env` being tracked) — it backs `infra.env_secrets` but is only ever run manually. This
sprint promotes the same idea (gitleaks) into CI via the official `gitleaks/gitleaks-action`,
which runs `gitleaks detect` against the PR diff using gitleaks' own default ruleset
(includes an AWS access key ID rule matching `AKIA[0-9A-Z]{16}`, which covers the required
smoke-test string). Not reusing the shell script directly in CI — the action is the standard,
maintained way to run gitleaks in GitHub Actions and needs no extra install step.

### Explicitly OUT of scope this sprint

- Any resource under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone.
- `devops.ci_build_images` / `devops.ci_image_scan_trivy` — separate Tier 1 features, not
  touched here.
- Any branch-protection setting beyond the one required status check (no required reviews, no
  linear history, no push restrictions) — explicit instruction, this is shared repo-wide state.
- No AWS resources created/modified — this feature is 100% GitHub-side.

### Done conditions (copied verbatim from `devops/feature-list.json` acceptance)

- [x] gitleaks (or equivalent) runs on every PR via GitHub Actions.
- [x] The check is a required status check — a PR cannot merge while it's red, enforced by
      branch protection on `main`.
- [x] A PR containing a deliberately fake AWS-shaped key string fails the check.

### Verification plan (real commands, run for real)

- [x] `actionlint .github/workflows/secret-scan.yml` — clean before pushing.
- [x] `gh api repos/:owner/:repo/branches/main/protection` — checked BEFORE any change (confirm
      starting state: none existed).
- [x] `gh api -X PUT repos/:owner/:repo/branches/main/protection ...` — add only
      `required_status_checks.contexts` containing the secret-scan job's context name.
- [x] Real smoke PR: branch off this feature branch (it must already contain
      `secret-scan.yml` — a PR based on `main` alone won't trigger it pre-merge), commit a file
      containing an AWS-access-key-ID-shaped string (redacted here on purpose so this doc itself
      doesn't trip the scanner), push, `gh pr create --fill`, `gh pr checks` — secret-scan job
      must show failure.
- [x] `gh api repos/:owner/:repo/branches/main/protection | jq '.required_status_checks.contexts'
      | grep -q secret-scan`.
- [x] Clean up: close the smoke-test PR without merging, delete the branch (local + remote).

### Invariants that must still hold

- [x] No static AWS credentials introduced anywhere (n/a — no AWS calls in this workflow).
- [x] No-touch zone respected (`git diff` confirms nothing under `apps/*/src` or `libs/**`).
- [x] Branch protection change is surgical — only the one required check added, nothing else
      enabled.
- [x] Test PR containing the fake secret is closed (not merged) and its branch deleted after
      the check is proven to fail.

### Definition of done

- [x] Every Done condition checked with real evidence.
- [x] Every verify command actually run, output recorded.
- [x] `devops/feature-list.json` → `passing` (or left `blocked`/`failing` with exact reason).
- [x] `devops/progress.md` + `devops/session-handoff.md` + this file updated in the same commit.

---

## Superseded draft — was filled in before the IAM blocker was hit (kept for the concrete
approach and Done-condition checklist, still valid once Step 9's grant lands)

**Goal (one sentence):** Provision two ECR repositories (`scribe-api`, `scribe-web`) via
Terraform with `imageTagMutability = IMMUTABLE`, native scan-on-push enabled, and a lifecycle
policy expiring untagged images after 7 days — proven for real via a genuine double-push
rejection test, not just an `describe-repositories` field check.

**Tier:** 0 · **Branch:** `feat/devops-terraform-ecr`

### Context

`devops-agent`'s `scribe-devops-infra` managed policy already has `EcrRepos` (scoped to
`arn:aws:ecr:*:*:repository/scribe-*`, includes `CreateRepository`, `PutImageTagMutability`,
`PutLifecyclePolicy`, `PutImageScanningConfiguration`, plus push actions) and `EcrAuth`
(`ecr:GetAuthorizationToken` on `*`) statements from an earlier round. Plan: try
`terraform plan`/`apply` first: don't pre-emptively ask for a new IAM grant.

### Explicitly OUT of scope this sprint

- Any resource under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone.
- `devops.terraform_networking_rds` / `devops.terraform_compute_envs` — separate, blocked
  features, not touched here.
- CI workflows that push to ECR (`devops.cd_push_ecr_main`) — Tier 2, not this sprint.

### Done conditions (copied verbatim from `devops/feature-list.json` acceptance)

- [ ] Both repos have `imageTagMutability = IMMUTABLE`.
- [ ] `scanOnPush` enabled on both.
- [ ] Lifecycle policy expires untagged manifests >7 days old.
- [ ] Pushing the same tag twice fails (proves immutability, not just configured).

### Verification plan (real commands, run for real against AWS)

- [ ] `terraform plan` / `terraform apply` in `infra/terraform/` (local apply, human-authorized
      exception for this Tier 0 bootstrap phase per `devops/manual.md` precedent — document in
      `devops/progress.md`).
- [ ] `aws ecr describe-repositories --repository-names scribe-api scribe-web --query
      'repositories[].imageTagMutability'` — expect 2x `IMMUTABLE`.
- [ ] `aws ecr get-login-password | docker login` then `docker push
      <account>.dkr.ecr.us-east-1.amazonaws.com/scribe-api:smoke-test-tag` — first push succeeds.
- [ ] Same push again, same tag — must be REJECTED (this is the load-bearing proof).
- [ ] `aws ecr get-lifecycle-policy --repository-name scribe-api` (and `-web`) — confirm the
      untagged-expire-after-7-days rule.
- [ ] Clean up the smoke-test tag/image afterward.

### Invariants that must still hold

- [ ] No static AWS credentials introduced anywhere.
- [ ] No `latest` tag used anywhere, including in this sprint's own smoke test.
- [ ] No-touch zone respected (`git diff` confirms nothing under `apps/*/src` or `libs/**`).
- [ ] Local `terraform apply` logged in `devops/progress.md` with justification.

### Definition of done

- [ ] Every Done condition checked with real evidence.
- [ ] Every verify command actually run, output recorded.
- [ ] `devops/feature-list.json` → `passing` (or left `blocked` with exact reason, no faking).
- [ ] `devops/progress.md` + `devops/session-handoff.md` + this file updated in the same commit.

---

## Superseded draft — was filled in before the IAM/platform blockers were hit (kept for the
concrete approach and Done-condition checklist, still valid once Step 8's grant lands and/or
PR #9 merges)

**Goal (one sentence):** Create an IAM OIDC identity provider trusting
`token.actions.githubusercontent.com` + an IAM role GitHub Actions assumes via
`aws-actions/configure-aws-credentials`, trust-scoped to `repo:nimatrazmjo/harness-lab:*`
(not org-wide) with ref conditions limited to `main` and `pull_request`, and a least-privilege
permissions policy (ECR push to `scribe-api`/`scribe-web` only, `ssm:SendCommand` scoped to
deploy-tagged instances, ECS/EC2 describe for smoke checks) — zero static AWS keys anywhere.

**Tier:** 0 · **Branch:** `feat/devops-terraform-oidc-github`

### Context

`devops.terraform_ecr` also `dependsOn` this feature but is explicitly OUT of scope this
sprint — do not touch ECR repo resources, only reference the two repo names in the OIDC role's
ECR policy statement as placeholders for the repos `terraform_ecr` will create later.

### Explicitly OUT of scope this sprint

- `devops.terraform_ecr` — separate feature, not authorized here.
- Any resource under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone.
- A full CD pipeline workflow (push-on-main, deploy) — Tier 2, not this sprint.

### Done conditions (copied verbatim from `devops/feature-list.json` acceptance)

- [ ] No AWS access key / secret key exists anywhere in GitHub secrets or the codebase — auth
      is 100% OIDC.
- [ ] Trust policy's `token.actions.githubusercontent.com:sub` condition is scoped to
      `repo:nimatrazmjo/harness-lab:*` (not `repo:*`), with ref conditions limited to `main`
      and `pull_request` events.
- [ ] Role policy denies anything outside {ECR push to `scribe-api`/`scribe-web`,
      `ssm:SendCommand` to deploy-tagged instances, ECS/EC2 describe for smoke checks} — no
      `*` resource on a mutating action.

### Verification plan (real commands, run for real against AWS)

- [ ] `terraform plan` / `terraform apply` in `infra/terraform/` (local apply, human-authorized
      exception for this Tier 0 bootstrap phase per `devops/manual.md` precedent — document in
      `devops/progress.md`).
- [ ] `aws iam get-open-id-connect-provider --open-id-connect-provider-arn <arn>` — confirm
      issuer `token.actions.githubusercontent.com`, thumbprint present, client-id-list includes
      `sts.amazonaws.com`.
- [ ] `aws iam get-role --role-name scribe-github-actions-deploy` — inspect
      `AssumeRolePolicyDocument`, confirm `sub` condition is `repo:nimatrazmjo/harness-lab:*`
      (via `StringLike`), not `repo:*`.
- [ ] `aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names
      ecr:PutImage --resource-arns 'arn:aws:ecr:*:*:repository/unrelated-repo'` — expect
      `implicitDeny`.
- [ ] `aws iam simulate-principal-policy` for `ecr:PutImage` against
      `arn:aws:ecr:*:*:repository/scribe-api` — expect `allowed`.
- [ ] A minimal `oidc-smoke-test.yml` GitHub Actions workflow that assumes the role via OIDC
      and runs `aws sts get-caller-identity` with no `AWS_ACCESS_KEY_ID` set — gold-standard
      proof if time/scope allow; otherwise the `simulate-principal-policy` + `get-role` +
      `get-open-id-connect-provider` triad is the accepted direct-verification substitute.

### Invariants that must still hold

- [ ] No static AWS credentials introduced anywhere (workflow files, GitHub secrets, code).
- [ ] No-touch zone respected (`git diff` confirms nothing under `apps/*/src` or `libs/**`).
- [ ] Local `terraform apply` (if needed) logged in `devops/progress.md` with justification.
- [ ] Least privilege only — no wildcard resource on a mutating IAM statement.

### Definition of done

- [ ] Every Done condition checked with real evidence.
- [ ] Every verify command actually run, output recorded.
- [ ] `devops/feature-list.json` → `passing` (or left `blocked` with exact reason, no faking).
- [ ] `devops/progress.md` + `devops/session-handoff.md` + this file updated in the same commit.

---

## Superseded draft (was filled in before the blocker was hit — kept for the concrete approach,
still valid once IAM is fixed)

**Feature(s):** `devops.terraform_backend` — explicit human go-ahead received this session
("this creates a real S3 bucket + DynamoDB table in your AWS account (404063516240) via the
devops-agent IAM user, and requires a one-off local terraform apply — proceed?" → YES).

**Goal (one sentence):** Stand up a versioned/encrypted S3 bucket + DynamoDB lock table for
Terraform remote state, bootstrapped once via a small local-state Terraform config, then point
`infra/terraform/` at it so `terraform init` there uses the remote backend with zero local
`.tfstate`.

**Tier:** 0 · **Branch:** `feat/devops-terraform-backend`

### Context (why this is the next real gap)

Both Dockerfile items are `passing`. `devops.terraform_oidc_github` and `devops.terraform_ecr`
both `dependsOn: ["devops.terraform_backend"]` — they need a remote backend to write state into
rather than local `.tfstate` (never committed, per clean-state gates). This is the chicken-and-
egg bootstrap: the backend that stores Terraform state can't itself be created by Terraform
pointed at that same not-yet-existing backend, so it's bootstrapped via a separate, local-state
config, applied once, outside `infra/terraform/`.

### The concrete approach (decided up front)

- `infra/terraform-bootstrap/` — small standalone Terraform config, **local state** (gitignored),
  creates: `aws_s3_bucket` (versioning enabled, SSE-S3 AES256, public access fully blocked) +
  `aws_dynamodb_table` (PAY_PER_REQUEST, hash key `LockID`) for locking. Applied ONCE, locally,
  as the documented bootstrap exception to "terraform apply only ever runs from CI."
- `infra/terraform/` — the real, ongoing config (where `terraform_oidc_github`, `terraform_ecr`,
  etc. will live). Gets `backend.tf` (S3 backend block pointing at the bootstrap bucket/table)
  + `provider.tf` (aws provider, region us-east-1) + a placeholder `main.tf`. No resources yet —
  those come with later features.
- Bucket name: `scribe-terraform-state-404063516240` (account-id suffix for global uniqueness +
  auditability). Lock table: `scribe-terraform-locks`.
- Root `.gitignore` gets Terraform entries (`*.tfstate`, `*.tfstate.*`, `.terraform/`,
  `.terraform.lock.hcl` stays — actually committed per convention, see below) so the bootstrap's
  local state file is never committed.

### Explicitly OUT of scope (do not touch this sprint)

- Anything under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone for
  this entire workstream (devops/AGENTS.md), not just this sprint.
- VPC/RDS/EC2/OIDC/ECR — separate, later features, not authorized in this dispatch.
- Any devops feature not named above, even if adjacent/tempting.

### Done conditions (testable — copy verbatim from the feature's `acceptance` in
`devops/feature-list.json`)

- [ ] State bucket has versioning + SSE enabled, blocks public access.
- [ ] Lock table prevents concurrent apply (verified by a deliberate second `terraform apply`
      while one is in-flight).
- [ ] `terraform init` in `infra/terraform/` succeeds against the remote backend with no local
      `.tfstate` created.

### Invariants that must still hold (devops/AGENTS.md non-negotiables + root AGENTS.md §2)

- [ ] No static AWS credentials introduced (devops-agent profile is local CLI use, not a
      committed credential).
- [ ] No `latest` image tag introduced (n/a this sprint, no images touched).
- [ ] No-touch zone respected (`git diff` confirms nothing under `apps/*/src` or `libs/**`).
- [ ] The one local `terraform apply` (bootstrap only) is explicitly logged in
      `devops/progress.md` with justification, per clean-state-checklist's documented exception.

### Verification plan (the exact `verify` commands from `devops/feature-list.json`, and what
counts as evidence for each)

- [ ] `cd infra/terraform && terraform init` — real output, must succeed, must show "Successfully
      configured the backend \"s3\"", and `ls infra/terraform` must show no local `.tfstate` file
      after.
- [ ] `terraform state list` — must be reachable/non-error (empty list expected, no resources in
      `infra/terraform/` yet).
- [ ] `aws s3api get-bucket-versioning --bucket <state-bucket>` — real output, grep `Enabled`.
- [ ] Extra (not in the literal `verify` list but needed to satisfy acceptance #2 for real):
      `aws s3api get-bucket-encryption` + `aws s3api get-public-access-block` on the bucket;
      a genuine concurrent-apply test against the DynamoDB lock table (two `terraform apply`
      processes racing in `infra/terraform-bootstrap/`, second one must block/error on the lock).

### Definition of done

- [ ] Every _Done condition_ checked with evidence from the real target
- [ ] Every `verify` command actually run, output recorded
- [ ] `devops/evaluator-rubric.md` scored by a separate subagent/session — PASS or accepted
      CONDITIONAL
- [ ] `devops/feature-list.json` → `passing`; `devops/progress.md` + `devops/session-handoff.md`
      updated

---

## Prior sprint outcome — devops.dockerfile_api (2026-08-18)

All four Done conditions met with real evidence; all four literal `verify` commands run
end-to-end and green (build exit 0, container stays up, `curl -f /health` → `{"status":"ok",
"db":true}`, `whoami` → `node`, clean `docker stop`); extra evidence for "no TS source"
(`find -name '*.ts' -not -name '*.d.ts'` inside the image → empty) and "no dev dependencies"
(`typescript`/`jest`/`ts-node` absent from final `node_modules`). No static AWS creds, no
`latest` tag, no-touch zone respected (`git diff` confirms nothing under `apps/*/src` or
`libs/**`), `apps/api/.env.example` holds only placeholder/local-compose values. Full detail:
`devops/progress.md` (2026-08-18 entry) and `devops/session-handoff.md`. Status flipped to
`passing` in `devops/feature-list.json`, committed on `feat/devops-dockerfile-api`.
