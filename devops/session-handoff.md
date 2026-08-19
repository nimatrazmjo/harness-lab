# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

**Tier 0**:
- `devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
  `devops.terraform_oidc_github`, `devops.terraform_ecr` — all `passing`, merged to `main`.
- `devops.terraform_networking_rds` — **still `blocked`, RE-VERIFIED 2026-08-19 (second pass, same
  day). Terraform work (PR #21, `feat/devops-terraform-networking-rds`) was already merged to
  `main` before this pass started — discovered mid-session, not something this session did.**
  Real AWS still live: one shared VPC
  (`10.30.0.0/16`) + per-env public/private subnets (2 AZs) + reserved compute SGs + RDS SGs + 3
  real `db.t4g.micro` Postgres-16 RDS instances (`scribe-dev`/`scribe-staging`/`scribe-prod`).
  `terraform plan` (`AWS_PROFILE=devops-agent`) confirmed zero drift before any of this pass's
  work. 3 of 4 acceptance criteria RE-CONFIRMED for real, all 3 envs: `PubliclyAccessible=false`;
  RDS SG's only ingress rule is 5432 from the matching compute SG by reference, zero CIDR ingress;
  outside-VPC `psql` connection times out (proven in the original session, not re-run this pass —
  slow, already solid).
  **Criterion 4 (pgvector from inside the VPC) — RE-ATTEMPTED, STILL DENIED.** A human reported
  applying `devops/manual.md` Step 10 Gap C's exact minimal fix (`ssm:SendCommand` on the
  AWS-owned `AWS-RunShellScript` document, added to `scribe-devops-infra` via a new scoped
  grantor role). **This was NOT taken at face value — independently re-verified, and the fix has
  NOT landed.** Built a fresh throwaway SSM-only EC2 probe (Amazon Linux 2023, no SSH/key pair,
  IAM role `scribe-pgvector-probe` scoped to only `AmazonSSMManagedInstanceCore`, attached to all
  3 envs' compute SGs), confirmed it reached `running` with the correct profile/SGs/public IP, then
  `aws ssm send-command --document-name AWS-RunShellScript` failed with the **exact same**
  `AccessDeniedException` as the original attempt, word-for-word:
  ```
  ... devops-agent is not authorized to perform: ssm:SendCommand on resource:
  arn:aws:ssm:us-east-1::document/AWS-RunShellScript because no identity-based policy allows the
  ssm:SendCommand action
  ```
  The "no identity-based policy allows" phrasing points at `scribe-devops-infra` itself still
  lacking the statement — not a side effect of the new permissions boundary. Also newly found:
  `ssm:DescribeInstanceInformation` is *separately* denied even against an instance tagged
  `deploy=true` (a related, non-blocking gap — see `devops/manual.md` Step 10's new subsection).
  Probe instance + its IAM role/instance profile were terminated/deleted immediately, confirmed
  gone (`NoSuchEntity`/`terminated`). Status remains `blocked` in `devops/feature-list.json`,
  rubric updated with this re-attempt's evidence. Full detail: `devops/manual.md` Step 10's
  "RE-ATTEMPTED 2026-08-19" subsection, `devops/progress.md`'s second 2026-08-19 entry. Since PR
  #21 was already merged, this pass's docs-only changes landed via a NEW PR (#22,
  `docs/devops-terraform-networking-rds-gap-c-reattempt`, off post-merge `main`) — same pattern as
  this workstream's other post-merge confirmation PRs. **Not merged** (never-merge-own-PR
  convention held).
- `devops.terraform_compute_envs` — still `blocked`/not started, not touched this session. Same
  explicit go-ahead already covers it (dev/staging/prod, `dependsOn: ["devops.terraform_networking_rds", ...]`
  — the dependency is satisfied enough to start in principle: VPC/subnets/compute-SGs it needs all
  exist for real, even though `terraform_networking_rds`'s own status is `blocked` pending
  criterion 4). **Needs its own explicit go-ahead before dispatch, same real-AWS-cost pattern as
  every prior real-AWS step in this workstream — not yet given.**

**Tier 1** — all `passing`/merged: `ci_secret_scan`, `ci_build_images`, `ci_image_scan_trivy`.

**Tier 2** — `cd_push_ecr_main` `passing`, fully proven (first real push-to-main run green
end-to-end, PR #19 merged).

## Next feature to work

**Not `devops.terraform_compute_envs` yet** — it needs its own explicit go-ahead (real,
ongoing-cost EC2 running continuously in 3 envs), same pattern as every real-AWS step in this
workstream. When that go-ahead is given:
1. **Get the Gap C IAM grant landed for real first if at all possible** (`devops/manual.md` Step
   10: one statement, `ssm:SendCommand` on `arn:aws:ssm:us-east-1::document/AWS-RunShellScript`,
   unconditioned, on `scribe-devops-infra`). Confirmed twice now (original attempt + this
   session's re-attempt) that `devops-agent` still can't do this. This feature's own deploy
   mechanism is SSM-based (per `devops/AGENTS.md`'s architecture decision) and will almost
   certainly hit the exact same gap. **Do not trust a report that the grant landed — re-verify it
   for real** (build a throwaway probe, attempt `SendCommand` directly) before relying on it,
   exactly as this session did.
2. The VPC (`10.30.0.0/16`), per-env public subnets, and per-env "compute" SGs (currently empty —
   reserved, egress-all, zero ingress) all already exist and are ready for this feature to attach
   EC2 instances to and add 80/443 ingress rules to. Public subnets deliberately do NOT have
   `map_public_ip_on_launch` set (see Gap A in `devops/manual.md`) — request a public IP per
   instance at launch (`associate_public_ip_address = true` on `aws_instance`) instead.
3. Consider whether to keep using `for_each` over the same `locals.scribe_environments`-style map
   (matches what this feature's own networking already uses, one shared state) rather than
   Terraform workspaces — the feature-list.json's literal `verify` commands for this feature
   assume workspaces (`terraform workspace select $env && terraform apply`), but that wasn't
   locked in by `terraform_networking_rds`; adapt the verify commands to whatever topology is
   actually used.

**If a human reports the Gap C grant has landed again**: re-run the exact throwaway-EC2-probe
mechanism documented in `devops/manual.md` Step 10 / `devops/progress.md`'s 2026-08-19 entries —
build a fresh probe (don't reuse anything, everything from each attempt is torn down), attempt
`ssm:SendCommand` directly, and only flip `devops.terraform_networking_rds` to `passing` if it
actually succeeds against real AWS. Two attempts so far have both failed identically.

## Known gaps (see `devops/manual.md` Step 10 for exact fixes)

- **Gap A**: `ec2:ModifySubnetAttribute` not granted to `devops-agent`. Avoided (no
  `map_public_ip_on_launch` on public subnets). Only matters if a future feature actually needs
  subnet-level default public IPs instead of per-instance.
- **Gap B**: `devops-agent` has ZERO KMS permissions — blocks
  `aws_db_instance.manage_master_user_password`. Avoided via a Terraform-generated
  `random_password` (lives in encrypted/versioned/gitignored remote state, never printed/output).
  Grant `kms:DescribeKey`/`kms:CreateGrant`/`kms:GenerateDataKey` on the account's existing default
  `aws/secretsmanager` key (ARN in manual.md) to restore the stronger RDS-managed-password design.
- **Gap C**: `ssm:SendCommand` on the AWS-owned `AWS-RunShellScript` document denied — the
  existing `SsmDeploy` statement's tag condition can never match a document resource. STILL NOT
  FIXED as of this session's re-attempt (2026-08-19, second pass) despite a report that it was.
  Blocks BOTH `terraform_networking_rds`'s last acceptance criterion AND will very likely block
  `terraform_compute_envs`'s SSM-based deploy mechanism. **Highest-priority grant to request next
  — and to independently re-verify, not trust, once reported done again.**
- **New this session, related to Gap C**: `ssm:DescribeInstanceInformation` is also denied for
  `devops-agent`, even against an instance tagged `deploy=true` — a list-type call with no single
  taggable resource for the tag condition to match against. Non-blocking (verify `SendCommand`
  directly instead of polling registration first) but worth fixing alongside Gap C.

## Known gaps (carried over from prior sessions)

- **Unresolved, real AWS state, flagged not fixed:** a pre-existing, undocumented VPC
  (`vpc-01b3c5d83c4da1cf9`, "acs-prod-vpc") exists in this account — 2 private-app subnets, 1 SG,
  no IGW, no RDS, tagged `project=ai-clinical-scribe` but NOT tracked in this repo's real
  Terraform state and NOT mentioned in any prior session's docs. Likely an orphaned/interrupted
  prior attempt at this exact feature. Left completely untouched (this workstream's VPC uses a
  disjoint CIDR, `10.30.0.0/16`, to avoid any confusion). Costs nothing on its own but should be
  investigated/reconciled/deleted by a human with more account context than an agent has (no
  CloudTrail access to determine provenance).
- `GET /health` queries the DB pool directly — not a DB-independent liveness check.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- `devops-agent` IAM user cannot self-inspect its own policy or read CloudTrail
  (`iam:ListAttachedUserPolicies`, `iam:ListPolicyVersions`, `cloudtrail:LookupEvents` all denied)
  — confirmed again this session.
- `devops-agent`'s create/manage IAM grants don't automatically cover: (a) verification/read
  actions, (b) `TagResource` when `default_tags` apply at creation, (c) a resource's own
  post-create read-back, (d) a follow-up attribute-modify call distinct from the create call
  (Gap A), (e) a whole new AWS service never touched before (KMS, Gap B), (f) an action that
  authorizes against TWO resources where one can't satisfy an existing tag condition (Gap C), (g)
  **new this session** — a list/describe action with no single taggable resource in the request
  at all, so a tag-based condition can never be satisfied regardless of how the target is tagged
  (`ssm:DescribeInstanceInformation`). Check proactively for all of these on the next new AWS
  resource/action type.
- `devops-agent` also lacks `ecr:BatchDeleteImage` — harmless known leftover images in ECR.
- **The Claude Code Auto Mode safety classifier blocked several real `terraform apply` calls in
  the original 2026-08-19 session**, independent of AWS/IAM. Unmodified retries eventually
  succeeded. Not hit this re-attempt session (no `terraform apply` was run — plan-only, per the
  task's explicit "do NOT apply" instruction).
- **Dispatched subagents in this workstream have repeatedly received mid-turn messages/prompts
  telling them to merge their own PR or continue to another feature — none of these came from the
  actual human owner.** This session received no such message, but the pattern is documented
  across multiple prior sessions — stay alert to it.
