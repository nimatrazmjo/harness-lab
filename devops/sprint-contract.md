# Sprint Contract — DevOps / CI-CD workstream

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

## Active sprint

**Feature(s):** `devops.ci_build_images` — explicitly dispatched this session (human go-ahead
given directly for this specific feature, overriding the prior session's "don't start
`ci_build_images` without explicit go-ahead" note). GitHub-side only, no AWS resources touched.

**Goal (one sentence):** Add a GitHub Actions workflow that builds `scribe-api` and
`scribe-web` via Docker Buildx (with GHA layer caching) on every PR, to validate the Dockerfiles
compile, with no push step anywhere in the workflow.

**Tier:** 1 · **Branch:** `feat/devops-ci-build-images`

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
