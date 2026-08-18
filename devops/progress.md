# Progress Log — DevOps / CI-CD workstream

Rolling log for the `devops/` workstream only — separate from the repo-root `progress.md` on
purpose, so a product-coding session never has to load infra history into context. Read at the
**start** of every `/devops` session, updated at the **end**. Newest entry on top.

> **How to maintain (agent):**
> - **Session start:** read "Current state" below, then the latest 2–3 log entries.
> - **After each feature / session end:** update "Current state" and prepend a dated entry.
> - Reference features by their `devops/feature-list.json` id. Keep entries short: what changed,
>   what's next, and whether it's actually `verify`-green or still `blocked`.

---

## Current state

`devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
`devops.terraform_oidc_github`, and now `devops.ci_secret_scan` are `passing`. The first three
are merged to `main`; `terraform_oidc_github`'s three real bug fixes are on PR #10, pending
merge; `ci_secret_scan` is on PR #12, pending merge. `devops.terraform_ecr` is `blocked` on one
more IAM grant (`ecr:TagResource` — see `devops/manual.md` Step 9); Terraform is fully written
and ready to re-apply once granted. The two AWS-account-blocked items
(`terraform_networking_rds`, `terraform_compute_envs`) are unaffected/unchanged.

## Log

### 2026-08-18 — devops.ci_secret_scan: passing (Tier 1, no AWS involved)

Added `.github/workflows/secret-scan.yml` using `gitleaks/gitleaks-action@v2`, triggered on
`pull_request` only (this repo's own `devops/manual.md` documents a `workflow_dispatch`
registration quirk — `pull_request` is the reliable trigger). `actionlint` clean before
pushing. Branch `feat/devops-ci-secret-scan`, PR #12 (open, not merged — never merge own PR
per this workstream's rule).

Real end-to-end proof, in order:
1. Pushed the workflow on PR #12 itself — it fired immediately (contrary to an earlier worry,
   carried over from the `oidc-smoke-test.yml` history, that a brand-new `pull_request`-
   triggered workflow wouldn't run pre-merge; empirically it does run on the PR that introduces
   it). It correctly **failed** on its first run — gitleaks caught a literal AWS-key-shaped
   example string I'd written into `devops/sprint-contract.md`'s own verify-plan text (a real,
   if accidental, demonstration that the scanner works). Fixed by describing the pattern
   without a literal matching string, then squashed the fix into the same commit (force-pushed
   the still-unshared feature branch — nobody else had based work on it) so the fake secret
   never lingers in the PR's commit history. Both `secret-scan` and `verify-oidc` checks then
   passed clean.
2. `gh api repos/:owner/:repo/branches/main/protection` — confirmed `main` had **no** branch
   protection at all beforehand. Created it fresh, surgically: `required_status_checks:
   {strict: false, contexts: ["secret-scan"]}`, `enforce_admins: false`,
   `required_pull_request_reviews: null`, `restrictions: null` — no reviews/linear-
   history/push-restriction settings added, per the explicit "be surgical" instruction.
3. Real smoke-test PR #13 (`test/secret-scan-smoke`, branched off the feature branch — a
   branch off unmerged `main` alone wouldn't have the workflow file at all, so wouldn't trigger
   it): committed `scratch.txt` containing a fake `AKIA...`-shaped string, pushed, opened the
   PR. `secret-scan` check: **fail**. `gh pr view 13 --json mergeStateStatus` →
   `"BLOCKED"` (branch protection is genuinely stopping the merge, not just showing a red X).
   Closed PR #13 without merging, deleted `test/secret-scan-smoke` locally and on `origin`.
4. Verified `gh api .../branches/main/protection | jq '.required_status_checks.contexts'` →
   `["secret-scan"]`, matches the feature's literal verify command.

No AWS resources touched (confirmed GitHub-side only). No-touch zone respected (`git diff`
against `main` for this branch shows only `.github/workflows/secret-scan.yml`,
`devops/feature-list.json`, `devops/progress.md`, `devops/session-handoff.md`,
`devops/sprint-contract.md`). Status flipped to `passing` in `devops/feature-list.json`.

### 2026-08-18 — devops.terraform_ecr: blocked on ecr:TagResource

`infra/terraform/main.tf` got two new resource blocks: `aws_ecr_repository.scribe` (for_each
over `scribe-api`/`scribe-web`, `image_tag_mutability = "IMMUTABLE"`,
`image_scanning_configuration { scan_on_push = true }`) and
`aws_ecr_lifecycle_policy.scribe_expire_untagged` (one rule per repo: expire untagged images
`sinceImagePushed` > 7 days). `terraform init`/`plan` both ran clean against the real S3
backend (`AWS_PROFILE=devops-agent`) — plan showed `4 to add, 0 to change, 0 to destroy`, no
drift on the existing OIDC/role resources.

`terraform apply` failed immediately, before either repository existed:

```
Error: creating ECR Repository (scribe-api): ... AccessDeniedException: User:
arn:aws:iam::404063516240:user/devops-agent is not authorized to perform: ecr:TagResource on
resource: arn:aws:ecr:us-east-1:404063516240:repository/scribe-api because no identity-based
policy allows the ecr:TagResource action
```

Same error for `scribe-web`. Root cause: the provider's `default_tags` block (applied at the
provider level, tags every resource `Project`/`ManagedBy`) means ECR's `CreateRepository` call
bundles a tag-write, and AWS evaluates `ecr:TagResource` against that same call — a distinct
action from `ecr:CreateRepository`, not covered by the existing `scribe-devops-infra` policy's
`EcrRepos` statement (see `devops/manual.md` Step 1). Confirmed **no partial resources were
created**: `aws ecr describe-repositories --repository-names scribe-api scribe-web` →
`RepositoryNotFoundException` for both, and `terraform state list` shows no ECR resources — AWS
rejects `CreateRepository` atomically when the bundled tag-write is denied, so nothing needed
cleanup.

Left `status: blocked` in `devops/feature-list.json`, not faked `passing` — none of the four
`verify` commands could run for real (no repos exist yet). Exact minimal fix (add
`ecr:TagResource`/`ecr:UntagResource`/`ecr:ListTagsForResource` to `scribe-devops-infra`'s
`EcrRepos` statement, same `arn:aws:ecr:*:*:repository/scribe-*` resource scope) documented in
`devops/manual.md` Step 9, following the same "capture exact denied action, don't guess broad"
discipline as every prior grant round. Branch `feat/devops-terraform-ecr`, PR opened (not
merged — see `devops/session-handoff.md`). Once an admin applies Step 9, re-run
`terraform apply` then the full verify sequence, especially the double-push immutability test
(the load-bearing proof, not just eyeballing `imageTagMutability`).

### 2026-08-18 — devops.terraform_oidc_github: passing (found + fixed 3 real bugs to get there)

Picked up from the entry below (infra was applied and correctly scoped, but the verify proof
was incomplete). Getting the actual `oidc-smoke-test.yml` workflow to pass for real surfaced
three genuine, unrelated bugs — each confirmed via a real failing run, not guessed:

1. **YAML syntax error** (present since the workflow's creation, on every single run):
   `run: aws ecr get-authorization-token ... && echo "OK: ecr:GetAuthorizationToken allowed"`
   is an unquoted plain YAML scalar containing `": "` inside the embedded shell string — YAML's
   plain-scalar rules break on that, regardless of the shell's own quoting. Every run since the
   workflow was added had been failing at the parse stage with "workflow file issue" and a
   misleading `push`-event label, which masked the real problem. Confirmed with `actionlint`
   (installed via `brew install actionlint`) after `gh run view --log` gave no useful detail
   for a parse-level failure. Fixed by converting both offending `run:` lines to block scalars
   (`run: |`).
2. **OIDC trust policy mismatched the actual `sub` claim.** Once the YAML parsed, role
   assumption itself failed: `Not authorized to perform sts:AssumeRoleWithWebIdentity`. Added a
   temporary debug step (`actions/github-script` decoding the real ID token) and found GitHub
   sends `repo:nimatrazmjo@3712526/harness-lab@1332166375:pull_request` for this repo, not the
   plain `repo:nimatrazmjo/harness-lab:pull_request` the Terraform assumed — confirmed via `gh
   api repos/nimatrazmjo/harness-lab/actions/oidc/customization/sub`, which reports
   `"use_default": true` yet the default `sub_claim_prefix` already bakes in immutable
   owner_id/repo_id. This is apparently GitHub's current default for this account, not
   something explicitly configured. Fixed `infra/terraform/main.tf`'s `github_oidc_sub_prefix`
   local to the real value (with a comment explaining why, since it's non-obvious and would
   silently break again if forked to a different account). **Applied to real AWS** with
   explicit human confirmation (auto-mode's classifier flagged this one specifically since it's
   an IAM trust-policy change) — `terraform apply`: `0 added, 1 changed, 0 destroyed`.
3. **Smoke test's own credential check was backwards.** After the trust-policy fix, role
   assumption succeeded but the very next step failed: `FAIL: a static AWS_ACCESS_KEY_ID is set
   in this job`. This was the smoke test's own logic bug — `aws-actions/configure-aws-credentials`
   always exports temporary STS credentials under the `AWS_ACCESS_KEY_ID` env var name
   regardless of auth method (that's how the AWS CLI picks up any credential type), so "the env
   var is set" proves nothing about staticness. Fixed the check to assert the actual
   distinguishing signals instead: `AWS_SESSION_TOKEN` present + `AWS_ACCESS_KEY_ID` prefixed
   `ASIA` (temporary) rather than `AKIA` (long-lived IAM user key). Removed the temporary debug
   step once the trust-policy fix was confirmed.

**Final real run, all green** (PR #10, run via a genuine `pull_request` trigger — not
`workflow_dispatch`, which stayed stuck/undispatchable the whole session, apparently because
this workflow's ID was first registered on a non-default branch and GitHub's dispatch-eligibility
cache never picked up the merge to `main`; documented in `devops/manual.md` as a known quirk to
route around via `pull_request` instead of fighting it): role assumed with zero static keys,
temporary-credential check passed, in-scope `ecr:GetAuthorizationToken` and
`ssm:DescribeInstanceInformation` both succeeded, out-of-scope ECR repo and `iam:ListUsers` both
genuinely denied by AWS (not simulated). `aws iam simulate-principal-policy` (round 4's IAM
grant, `devops/manual.md` Step 8) independently confirmed the same least-privilege scoping.

`devops/feature-list.json` → `devops.terraform_oidc_github` `passing`. The 3 fixes above are on
PR #10 (opened as a throwaway trigger-only PR, ended up carrying real fixes) — needs a normal
merge like any other feature PR, not a close. Next: `devops.terraform_ecr` (Tier 0, now fully
unblocked) — `devops-agent`'s `scribe-devops-infra` policy already has `EcrRepos`/`EcrAuth`
statements from an earlier round, worth checking before assuming a fresh grant is needed.

### 2026-08-18 — devops.terraform_oidc_github: blocked (infra applied, verify proof incomplete)

`terraform apply` in `infra/terraform/` (`AWS_PROFILE=devops-agent`) succeeded on the **first
try** — `3 added, 0 changed, 0 destroyed`: `aws_iam_openid_connect_provider.github_actions`,
`aws_iam_role.github_actions_deploy`, `aws_iam_role_policy.github_actions_deploy_permissions`.
No new IAM grant was needed for creation — the `scribe-devops-bootstrap` policy's
`OidcProviderManage`/`GithubActionsRoleManage` statements (from `devops.terraform_backend`'s
Step 1) already covered it. Local apply authorized per `devops/manual.md`'s established
Tier-0-bootstrap exception, same as `devops.terraform_backend`.

Fixed a real bug while writing the config: a hand-typed OIDC thumbprint was 39 hex chars (an
invalid SHA1 length — should be 40) — replaced with the Terraform-recommended pattern of
fetching it dynamically via `data.tls_certificate`, which avoids hardcoding entirely.

Verified for real against AWS:
- `aws iam get-open-id-connect-provider` — issuer `token.actions.githubusercontent.com`,
  `client_id_list` includes `sts.amazonaws.com`, thumbprint populated. ✓
- `aws iam get-role --role-name scribe-github-actions-deploy` — trust policy's `sub` condition
  (`StringLike`) is exactly `["repo:nimatrazmjo/harness-lab:ref:refs/heads/main",
  "repo:nimatrazmjo/harness-lab:pull_request"]` — scoped to this repo only, not `repo:*`,
  ref-limited to main + PR events as required. ✓

Blocked on the third required proof:
- `aws iam simulate-principal-policy --policy-source-arn <role-arn> --action-names ecr:PutImage
  --resource-arns 'arn:aws:ecr:*:*:repository/unrelated-repo'` → real `AccessDenied`:
  `devops-agent` is not authorized to perform `iam:SimulatePrincipalPolicy` on
  `arn:aws:iam::404063516240:role/scribe-github-actions-deploy` — this action itself was never
  granted (it's a verification/testing action, distinct from the create/manage actions Step 1
  covered). Exact minimal fix documented as `devops/manual.md` Step 8.

Also wrote `.github/workflows/oidc-smoke-test.yml` (assumes the role via OIDC, asserts no
`AWS_ACCESS_KEY_ID` is set, asserts `ecr:GetAuthorizationToken`/`ssm:DescribeInstanceInformation`
succeed, asserts `ecr:DescribeRepositories` on an out-of-scope repo and `iam:ListUsers` both get
real `AccessDenied`) as the gold-standard proof path. It does not execute yet: opening PR #9
(same-repo PR, branch → main) did not trigger a `pull_request` run
(`gh api .../actions/runs?event=pull_request` → `total_count: 0`), and
`gh workflow run oidc-smoke-test.yml --ref feat/devops-terraform-oidc-github` was rejected
(`Workflow does not have 'workflow_dispatch' trigger`) even though the file on that branch has
both triggers. This is a known GitHub Actions platform behavior — `pull_request`/
`workflow_dispatch` triggers aren't registered/dispatchable for a workflow file until it exists
on the default branch. Confirmed this isn't a repo-settings issue via `gh api
repos/.../actions/permissions` (Actions enabled, `allowed_actions: all`). Will self-resolve on
merge — documented in `devops/manual.md` so it isn't re-diagnosed from scratch.

Left `status: blocked` (not faked `passing`) in `devops/feature-list.json` with the precise
reason. PR #9 opened on `feat/devops-terraform-oidc-github`, **not merged** — per this
workstream's explicit rule against agents merging their own PRs.


### 2026-08-18 — devops.terraform_backend: passing (real AWS, fully verified)

Unblocked from the prior entry below via three rounds of scoped IAM grants to `devops-agent`
(full detail, exact JSON, and root-cause analysis in `devops/manual.md`):

1. **Round 1** (`s3:CreateBucket`, `dynamodb:CreateTable` + config actions, split into two
   managed policies after an inline-policy attempt silently failed on IAM's 2,048-char inline
   aggregate limit) — got `terraform apply` past `AccessDenied` on creation, but it then failed
   on the AWS provider's post-create read-back (`s3:GetBucketPolicy`,
   `dynamodb:DescribeContinuousBackups` denied), which **tainted** both resources in state
   (wanted to destroy+recreate). `lifecycle.prevent_destroy` correctly blocked the replace — no
   data loss, no actual destroy attempted. Cleared the false taint with `terraform untaint` on
   both (the underlying AWS resources were fine).
2. **Round 2** (broadened to `s3:Get*` / `dynamodb:Describe*`, scoped to just these two specific
   resource ARNs — avoids granting anything on other buckets/tables, and avoids patching the AWS
   provider's many auxiliary read calls one action at a time) — got `terraform plan` fully clean
   (no more taint), but surfaced one more gap: `dynamodb:ListTagsOfResource` (outside the
   `Describe*` namespace).
3. **Round 3** (added `ListTagsOfResource` + `UntagResource`) — `terraform apply` succeeded
   cleanly: `Apply complete! Resources: 3 added, 0 changed, 0 destroyed` (versioning, SSE
   config, public-access-block — the bucket + table themselves were already live from round 1).

**All three acceptance criteria verified for real:**
- `aws s3api get-bucket-versioning` → `{"Status": "Enabled"}`; `get-public-access-block` → all
  four flags `true`; `get-bucket-encryption` → `AES256`.
- Concurrent-apply lock test: ran `terraform plan -lock-timeout=5s` in the background, then a
  second `terraform plan -lock-timeout=1s` immediately after — second one failed with `Error
  acquiring the state lock ... resource temporarily unavailable`, succeeded cleanly once the
  first released it. Real proof the DynamoDB table blocks concurrent applies, not assumed.
- `cd infra/terraform && terraform init` → `Terraform has been successfully initialized!`, no
  local `.tfstate` created. `terraform state list` initially errored (`No state file was
  found!`) — this is expected S3-backend behavior when the state key has never been written
  (infra/terraform/main.tf has zero resources, never applied), not a permissions problem;
  confirmed via `aws s3api list-objects-v2` showing no object at `scribe/terraform.tfstate`.
  Ran one zero-resource `terraform apply` (creates no real infrastructure, just writes the
  initial empty state file) to make `state list` match the literal verify command's expectation
  (`# reachable, non-error even if empty`) — after that, `state list` exits 0 and the state
  object exists in S3.

`devops/feature-list.json` → `devops.terraform_backend` `passing`. Next: `devops.terraform_ecr`
or `devops.terraform_oidc_github` (Tier 0, unblocked now that this dependency is satisfied) —
each will need its own scoped `devops-agent` IAM grant first, following the same pattern
documented in `devops/manual.md`.

### 2026-08-18 — devops.terraform_backend: blocked (IAM permissions, not toolchain)

**What was authorized:** explicit human go-ahead this session to provision a real S3 bucket
(`scribe-terraform-state-404063516240`) + DynamoDB table (`scribe-terraform-locks`) via the
`devops-agent` IAM profile, and to run `terraform apply` locally ONCE as the documented
bootstrap exception to "terraform apply only ever runs from CI on merge to main" (per
devops/AGENTS.md + devops/clean-state-checklist.md — this is that logged exception).

**What was built (all committed, ready to apply once unblocked):**
- `infra/terraform-bootstrap/main.tf` — standalone config, intentionally LOCAL state
  (gitignored via its own `.gitignore`), creates the S3 bucket (versioning Enabled, SSE-S3
  AES256 with `bucket_key_enabled`, full `aws_s3_bucket_public_access_block` — all four flags
  true) + `aws_dynamodb_table.terraform_locks` (PAY_PER_REQUEST, hash key `LockID`, the classic
  Terraform S3-backend locking schema).
- `infra/terraform/backend.tf` — `backend "s3"` block pointing at that bucket/table (key
  `scribe/terraform.tfstate`, region `us-east-1`, `encrypt = true`). Note: Terraform 1.15.8
  warns `dynamodb_table` is deprecated in favor of `use_lockfile` (native S3 locking, 1.10+) —
  kept `dynamodb_table` deliberately because the feature's acceptance criteria explicitly
  requires a DynamoDB lock table verified by a real concurrent-apply test, not S3-native
  locking. Revisit if that requirement ever changes.
- `infra/terraform/provider.tf`, `infra/terraform/main.tf` (placeholder — no resources yet,
  those come with `terraform_oidc_github`/`terraform_ecr`/later items).
- Root `.gitignore` gained standard Terraform entries (`**/.terraform/`, `*.tfstate*`,
  `*.tfplan`, override files) — no local `.tfstate` is ever committable now, satisfying
  acceptance criterion 3 structurally even though the bucket itself doesn't exist yet.

**What was actually run (real AWS, `AWS_PROFILE=devops-agent`):**
1. `terraform init` in `infra/terraform-bootstrap/` — succeeded (installed `hashicorp/aws
   ~> 5.0`, local backend).
2. `terraform plan` — clean, 5 resources to add (bucket, versioning, SSE config, public-access
   block, DynamoDB table), 0 to change/destroy.
3. `terraform apply "bootstrap.tfplan"` — **FAILED**, real AWS `AccessDenied`:
   ```
   Error: creating S3 Bucket (scribe-terraform-state-404063516240): ... StatusCode: 403 ...
   AccessDenied: User: arn:aws:iam::404063516240:user/devops-agent is not authorized to
   perform: s3:CreateBucket on resource: "arn:aws:s3:::scribe-terraform-state-404063516240"

   Error: creating AWS DynamoDB Table (scribe-terraform-locks): ... StatusCode: 400 ...
   AccessDeniedException: User: arn:aws:iam::404063516240:user/devops-agent is not authorized
   to perform: dynamodb:CreateTable on resource:
   arn:aws:dynamodb:us-east-1:404063516240:table/scribe-terraform-locks
   ```
4. Confirmed no partial/orphan resources: `aws s3api head-bucket` → 404 Not Found (bucket does
   not exist); `terraform state list` shows only the `aws_caller_identity` data source, no real
   resources in state. Nothing to tear down.
5. `cd infra/terraform && terraform init` against the S3 backend — **FAILED as expected** (the
   bucket genuinely doesn't exist yet): `Error: Failed to get existing workspaces: S3 bucket
   "scribe-terraform-state-404063516240" does not exist.` This confirms acceptance criterion 3
   is not yet met — correctly reported as such, not faked.
6. Tried to self-diagnose the IAM user's actual policy (`iam:ListAttachedUserPolicies`,
   `iam:ListUserPolicies`, `iam:ListGroupsForUser`) — all three also `AccessDenied`. The
   `devops-agent` user cannot even introspect its own permissions; account owner needs to check
   the IAM console/CloudTrail directly.

**Minimal fix needed (for whoever grants IAM):** attach a policy to `devops-agent` allowing at
least `s3:CreateBucket`, `s3:PutBucketVersioning`, `s3:PutBucketPublicAccessBlock`,
`s3:PutEncryptionConfiguration`, `s3:GetBucket*`, `s3:ListBucket`, `s3:GetObject`,
`s3:PutObject`, `s3:DeleteObject` (scoped to `arn:aws:s3:::scribe-terraform-state-*` and its
objects) + `dynamodb:CreateTable`, `dynamodb:DescribeTable`, `dynamodb:GetItem`,
`dynamodb:PutItem`, `dynamodb:DeleteItem` (scoped to
`arn:aws:dynamodb:us-east-1:404063516240:table/scribe-terraform-locks`) — the last four are
what the S3 backend itself needs at every `terraform init`/`plan`/`apply`, not just bootstrap.

**Not done, deliberately:** did not attempt `AWS_PROFILE=default` (root — hard-blocked and
explicitly forbidden), did not modify IAM policy myself (out of scope, and `devops-agent`
can't even read its own policy), did not fake `passing`. Status left `blocked` in
`devops/feature-list.json`. `terraform_oidc_github` / `terraform_ecr` remain `failing` (both
`dependsOn: ["devops.terraform_backend"]`) — don't start those until this unblocks.

**Invariants held:** no static AWS credential written anywhere (the one local apply used the
pre-existing `devops-agent` profile, not a new key); no `latest` tag (n/a, no images touched);
no-touch zone respected (`git diff --stat` confirms nothing under `apps/*/src`, `apps/web/src`,
or `libs/**`); the one local `terraform apply` is this very log entry — the documented
exception, not a violation.

### 2026-08-18 — devops.dockerfile_web: passing
Multi-stage `apps/web/Dockerfile`, sibling to the just-finished `devops.dockerfile_api`.
Build stage: `node:22-slim` (same digest as the API image, same reason — `pnpm@11.13.1`
requires Node >=22.13 to run at all), builds `@scribe/shared-types` then `pnpm --filter web
run build` (`tsc --noEmit && vite build` -> `apps/web/dist`). Runtime stage:
`nginxinc/nginx-unprivileged:stable-alpine` pinned by sha256 digest — ships a built-in
non-root `nginx` user (uid 101) and listens on 8080 by default, so no manual non-root setup
needed. COPYs only the built `dist/` into `/usr/share/nginx/html`; no `node_modules`, no
`.ts`/`.tsx` source anywhere in the final image (confirmed via `find` inside the running
container — both empty).

New `apps/web/nginx.container.conf.template` — an envsubst template (processed by the base
image's built-in `20-envsubst-on-templates.sh` entrypoint into
`/etc/nginx/conf.d/default.conf` at container start) mirroring `infra/nginx.conf`'s two
`/api/*` location blocks verbatim in intent: the SSE-safe `proxy_buffering off` route for
`/api/encounters/*/scribe/*` (note-generation streaming) and the generic `/api/` strip-and-
proxy for everything else, plus `location / { try_files $uri /index.html; }` for the SPA.
Upstream host is `${API_UPSTREAM}`, defaulted to the literal IP `http://127.0.0.1:3000` (not a
DNS name) specifically so nginx never fails to *start* when no API container is linked, as in
this feature's standalone smoke test — a real docker-compose deployment overrides it.
`infra/nginx.conf` itself untouched (read for reference only — it's the real EC2-host config
that also does TLS termination, a different job than this container's).

`.dockerignore`: written fresh on this branch (cut from `main` before the API Dockerfile PR
merged) — kept both `apps/api/src` and `apps/web/src` un-excluded since both Dockerfiles now
need their own app's source when this and the API branch eventually share one `.dockerignore`
on `main`.

Ran every literal `verify` command for real, end-to-end: `docker build` -> 0 exit; `docker run
-d -p 8099:8080` -> container up, nginx logs show config templated and workers started; `curl
-f http://localhost:8099/ | grep -qi 'AI Clinical Scribe'` -> matched (index.html's `<title>`);
`docker stop` -> clean. Extra evidence: `docker exec ... id` -> `uid=101(nginx)`; `nginx -t`
inside the container -> syntax ok; rendered `/etc/nginx/conf.d/default.conf` inspected and
confirmed the `/api/` and SSE-route blocks match `infra/nginx.conf`'s rewrite/proxy_buffering
behavior (verify command itself never exercises the proxy — no linked API container — so this
part is inspected, not curl-tested).

`devops/feature-list.json` → `devops.dockerfile_web` `passing`. Next: both Dockerfile PRs are
merged — pick up `devops.terraform_backend` or `devops.terraform_oidc_github` (Tier 0,
unblocked, no real-AWS-account provisioning needed for backend/OIDC bootstrap itself — just
`terraform init`/`plan` against the account already available via the `devops-agent` profile).

### 2026-08-18 — devops.dockerfile_api: passing
Multi-stage `apps/api/Dockerfile` (`node:22-slim` pinned by sha256 digest — see below for why
22 not the workspace's ">=20" floor). Build stage: `pnpm install --frozen-lockfile` (needs
`apps/api`, `apps/web`, `libs/shared-types`, `libs/ai` package.json + root
`tsconfig.base.json` copied first), builds `@scribe/shared-types` -> `@scribe/ai` -> `api` in
dependency order, then `CI=true pnpm install --frozen-lockfile --prod` prunes devDeps.
Runtime stage mirrors the build stage's `/repo` layout (so pnpm's relative node_modules
symlinks into the shared `.pnpm` store keep resolving) and COPYs only `dist/` +
`package.json` + `node_modules` per package — no `src/`, `test/`, `tsconfig*`, `apps/web`.
Runs as the base image's built-in `node` user (uid 1000).

New: `apps/api/Dockerfile`, `apps/api/.env.example` (didn't exist before — the feature's
`verify` commands need it for `--env-file`; docker-smoke-only values, no real secrets),
root `.dockerignore` (didn't exist before).

Two real findings, recorded in the Dockerfile/`.env.example` comments and
`devops/session-handoff.md`:
- `packageManager: pnpm@11.13.1` requires Node >=22.13 to run at all (confirmed:
  `ERR_UNKNOWN_BUILTIN_MODULE node:sqlite` under Node 20) — forced the base image to
  `node:22-slim`, not the workspace's `engines: >=20`. This is pnpm's own runtime floor, not a
  choice about the app's target Node version.
- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly —
  it is not a DB-independent liveness check. Verified real 200 by pointing
  `apps/api/.env.example`'s `DATABASE_URL` at `host.docker.internal:5433`, the already-running
  local `scribe-postgres` compose container (`infra/docker-compose.yml`) — no AWS, no faked
  backend beyond what the task already allowed (`AI_PROVIDER=mock`). No app-code touched.

Ran every literal `verify` command from `devops/feature-list.json` for real, in order,
end-to-end: `docker build` → 0 exit; `docker run -d --env-file apps/api/.env.example -e
AI_PROVIDER=mock` → container up, Nest logs show all modules initialized + all routes mapped;
`curl -f http://localhost:3099/health` → `{"status":"ok","db":true}`; `docker exec ... whoami |
grep -v root` → `node` (exit 0); `docker stop` → clean. Extra evidence beyond the literal list:
`find / -name '*.ts' -not -name '*.d.ts' -not -path '*/node_modules/*'` inside the built image
→ empty (no real TS source shipped, only compiled `.d.ts` alongside `dist/`); `node_modules`
has no `typescript`/`jest`/`ts-node` (devDeps pruned); `id` inside container →
`uid=1000(node) gid=1000(node)`.

`devops/feature-list.json` → `devops.dockerfile_api` `passing`. Next:
`devops.dockerfile_web` (sibling Tier 0 item, same unblocked status, no AWS needed).

### 2026-08-18 — workstream created, isolated from root context
Moved `devops-feature-list.json` from repo root into `devops/feature-list.json`, added
`devops/AGENTS.md` (scoped harness contract) + `devops/CLAUDE.md` (bridge) + this file, and a
`/devops` skill (`.claude/skills/devops/SKILL.md`) that dispatches the actual work to a
worktree-isolated subagent — so neither the devops context nor its work-in-progress ever
lands in a normal coding session. Root `AGENTS.md` trimmed to a one-line pointer. Next: pick up
`devops.dockerfile_api` or `devops.dockerfile_web` (Tier 0, unblocked, no AWS access needed).
