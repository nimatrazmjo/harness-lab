# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

`devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend` — all `passing`,
merged to `main`.

`devops.terraform_oidc_github` — **`passing`** (2026-08-18, this session). Fully verified for
real: the `oidc-smoke-test.yml` GitHub Actions workflow ran end-to-end via a genuine
`pull_request` trigger and every step passed (role assumed via OIDC with zero static keys,
temporary-credential check, in-scope ECR/SSM actions succeeded, out-of-scope ECR
repo/`iam:ListUsers` genuinely denied). `aws iam simulate-principal-policy` independently
confirmed the same least-privilege scoping.

**Getting there surfaced and fixed 3 real, unrelated bugs** (full detail in
`devops/progress.md`'s 2026-08-18 entry) — worth knowing about if similar workflows/Terraform
get written later:
1. A YAML syntax error (unquoted `run:` value containing `": "` inside an embedded shell
   string) silently failed every single run since the workflow was created — `actionlint`
   caught it, `gh run view --log` did not (parse-level failures give no useful job/step logs).
2. The OIDC trust policy's `sub` condition assumed the plain `repo:owner/repo:...` format, but
   this GitHub account's actual default subject claim bakes in immutable owner_id/repo_id
   (`repo:nimatrazmjo@3712526/harness-lab@1332166375:...`) — confirmed by decoding a real ID
   token, not from docs. Fixed in `infra/terraform/main.tf`'s `github_oidc_sub_prefix` local,
   with a comment explaining why (this will silently break again if this Terraform is ever
   forked to a different account without re-checking).
3. The smoke test's own "no static credentials" check was backwards — it treated the mere
   presence of the `AWS_ACCESS_KEY_ID` env var as proof of a static key, but
   `aws-actions/configure-aws-credentials` always exports temporary STS credentials under that
   same env var name. Fixed to check the actual signals (`ASIA` prefix + `AWS_SESSION_TOKEN`
   present).

**PR #10 has these 3 fixes and needs a normal merge** — it started as a throwaway
trigger-only PR (to get the `pull_request` event to fire) but ended up carrying real,
verified infra/workflow fixes. Don't close it without merging.

## Next feature to work

**`devops.terraform_ecr`** (Tier 0, now fully unblocked — its `dependsOn` is satisfied).
`devops-agent`'s `scribe-devops-infra` managed policy already has `EcrRepos`/`EcrAuth`
statements from an earlier round — check whether that's sufficient before assuming a fresh IAM
grant is needed; if not, expect the same iterative discovery pattern documented in
`devops/manual.md` (run `terraform apply` for real, capture the exact denied action, don't
guess a broad fix).

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
- `devops-agent`'s create/manage IAM grants don't automatically cover verification/read actions
  like `iam:SimulatePrincipalPolicy` — a distinct category from the `Get*`/`Describe*`
  read-back gaps found in `devops.terraform_backend`. Expect this to recur for future features
  that lean on `simulate-principal-policy`-style proofs.
- **`workflow_dispatch` can get permanently stuck for a workflow's lifetime if its GitHub
  Actions "workflow ID" was first registered while the file only existed on a non-default
  branch** — merging to `main` does NOT reliably fix it (confirmed: waited 2+ minutes, polled
  repeatedly, still `422 Workflow does not have 'workflow_dispatch' trigger` well after merge).
  The `pull_request` trigger worked immediately and is the reliable fallback — use it instead
  of fighting `workflow_dispatch` registration lag. Documented in `devops/manual.md`.
- `actionlint` (installed this session via `brew install actionlint`) is now available locally
  — lint any new/edited workflow YAML with it before pushing; a parse-level YAML error gives no
  useful job/step logs via `gh run view`, only a generic "workflow file issue" annotation, so
  catching it before push saves a full debug cycle.
