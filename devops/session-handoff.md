# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

Nothing built yet. `devops/feature-list.json` fully planned (16 features, 4 tiers) but every
item is `failing` or `blocked` — this is a fresh workstream as of 2026-08-18.

## Next feature to work

**`devops.dockerfile_api`** or **`devops.dockerfile_web`** (Tier 0, both unblocked — no AWS
account access needed for either). Either order is fine; they don't depend on each other.

Do NOT start `devops.terraform_networking_rds` / `devops.terraform_compute_envs` — both
`blocked` on real AWS account access. Everything else in Tier 0
(`devops.terraform_backend`, `devops.terraform_oidc_github`, `devops.terraform_ecr`) needs an
AWS account too (to actually provision and `verify` against), so if account access still isn't
available, the two Dockerfiles are the only real progress possible this session.

## Known gaps

- No AWS account connected yet — confirm with the user before attempting anything that needs
  `verify` commands to run against real AWS (Terraform apply, ECR push, etc.). Dockerfile items
  can be fully built and `verify`-tested locally with plain `docker build`/`docker run` — no AWS
  needed.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided — ask before
  provisioning DNS/cert resources.
