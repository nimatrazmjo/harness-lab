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

## Active sprint

**Feature(s):** `devops.terraform_oidc_github` — `devops.terraform_backend` is now `passing`
(real S3+DynamoDB remote state, confirmed 2026-08-18), so this Tier 0 item is unblocked.

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
