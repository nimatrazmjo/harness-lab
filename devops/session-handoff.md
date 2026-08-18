# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

`devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend` — all `passing`,
merged to `main`.

`devops.terraform_oidc_github` — **`blocked`** (2026-08-18, this session). The real
infrastructure is applied and correct:
- `aws_iam_openid_connect_provider.github_actions` — live, trusts
  `token.actions.githubusercontent.com`, `client_id_list` includes `sts.amazonaws.com`.
- `aws_iam_role.github_actions_deploy` (`scribe-github-actions-deploy`) — live, trust policy
  confirmed scoped to `repo:nimatrazmjo/harness-lab:ref:refs/heads/main` +
  `repo:nimatrazmjo/harness-lab:pull_request` only (not `repo:*`, not org-wide).
- `aws_iam_role_policy.github_actions_deploy_permissions` — least-privilege: ECR push/pull
  scoped to `scribe-api`/`scribe-web` repo ARNs, `ssm:SendCommand` scoped to
  `ssm:resourceTag/deploy=true`, EC2/ECS describe for smoke checks. No wildcard resource on a
  mutating statement.

**Not yet possible to fully verify — two separate blockers, NOT the same thing:**
1. **IAM gap** (needs a human grant): `aws iam simulate-principal-policy` denied for
   `devops-agent` — `iam:SimulatePrincipalPolicy` itself was never granted. Exact JSON fix in
   `devops/manual.md` Step 8. This is the ONE remaining ask to complete the required verify
   triad (`get-role` ✓, `get-open-id-connect-provider` ✓, `simulate-principal-policy` blocked).
2. **GitHub platform quirk** (no grant needed, self-resolves): the committed
   `.github/workflows/oidc-smoke-test.yml` (PR #9) doesn't execute — GitHub doesn't register
   `pull_request`/`workflow_dispatch` triggers for a workflow file that only exists on a
   non-default branch. Will start working the moment this PR (or any PR with this file) merges
   to `main`. Documented in `devops/manual.md` so it isn't re-diagnosed.

PR #9 (`feat/devops-terraform-oidc-github`) is open, **not merged** — per this workstream's
rule, agents don't merge their own PRs.

## Next feature to work

Not a new feature — **resume `devops.terraform_oidc_github`** once either blocker clears:
- If Step 8's IAM grant lands: re-run `aws iam simulate-principal-policy` (commands in
  `devops/sprint-contract.md`'s superseded-draft verification plan), then flip to `passing`.
- If PR #9 merges first: `oidc-smoke-test.yml` will run automatically on the next PR against
  `main` that touches it (or via a follow-up PR) — use that run's output as the gold-standard
  proof instead of/in addition to `simulate-principal-policy`.
- Either proof alone (plus the `get-role`/`get-open-id-connect-provider` evidence already
  collected) is sufficient to flip `passing` — don't wait for both.

`devops.terraform_ecr` still `dependsOn` this feature — stays unstarted until this flips.

`devops.terraform_networking_rds` / `devops.terraform_compute_envs` remain `blocked` for
unrelated reasons (domain name for certbot; sequencing). Unaffected by this session.

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — not
  a DB-independent liveness check. Relevant for `devops.ci_build_images` /
  `devops.ci_image_scan_trivy` later.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided.
- `devops-agent` IAM user cannot self-inspect its own policy (`iam:ListAttachedUserPolicies`/
  `ListUserPolicies`/`ListGroupsForUser` all `AccessDenied`) — verifying what's actually granted
  requires the AWS console or an admin profile.
- **New this session:** `devops-agent`'s existing grants cover create/manage IAM actions but
  not verification/read actions like `iam:SimulatePrincipalPolicy` — a distinct category from
  the `Get*`/`Describe*` read-back gaps found in `devops.terraform_backend`. Expect this pattern
  (verification tooling needing its own explicit grant, separate from the resource's own
  create/read-back permissions) to recur for future features that also lean on
  `simulate-principal-policy`-style proofs.
- **New this session:** a workflow file added in a PR branch does not get
  `pull_request`/`workflow_dispatch` triggers registered until it exists on the default branch
  — plan CI/CD feature verification around this (e.g. the first real proof of any new workflow
  may need to wait for that PR to merge, or use direct AWS-side verification instead).
