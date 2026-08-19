# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

**Tier 0** — done except two items genuinely blocked on a pending scope decision, not a
technical/IAM issue:
- `devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
  `devops.terraform_oidc_github`, and now `devops.terraform_ecr` — all `passing`, all merged to
  `main` (`terraform_ecr`'s reconciliation PR #18 merged during this session).
- `devops.terraform_ecr` — **status discrepancy from prior sessions, RESOLVED this session.**
  Root cause: PR #11 merged `feat/devops-terraform-ecr` to `main` at its *blocked* commit
  (`8a35335`), but the remote branch was never deleted and picked up one further, never-merged
  commit (`be8a00f`, "flip terraform_ecr to passing with real double-push proof") that actually
  finished the work — 2 more IAM rounds past the original block (`ecr:TagResource`, then
  `ecr:GetLifecyclePolicy`) — but that commit only ever landed on the stranded branch, never
  `main`, so `feature-list.json` kept reading `blocked`. Did NOT trust either doc: independently
  re-verified all 4 acceptance criteria live against AWS this session
  (`AWS_PROFILE=devops-agent`) — both repos `IMMUTABLE` + `scanOnPush=true`, both lifecycle
  policies expire untagged images >7 days, and a **fresh** double-push test (pushed a genuinely
  different image, `alpine:3.18`, to the already-existing `scribe-api:smoke-test-tag` — rejected
  with ECR's immutability error). `terraform plan` (plan-only, no apply) shows zero drift — both
  `aws_ecr_repository` and `aws_ecr_lifecycle_policy` resources cleanly tracked in real remote
  state. Confirmed via git history that both repos were created by a **local** `terraform apply`
  under `AWS_PROFILE=devops-agent` (not CI — this repo has no `terraform apply` workflow at all
  yet), matching the same documented Tier-0-bootstrap local-apply exception already used for
  `terraform_backend`/`terraform_oidc_github`. `devops/feature-list.json` → `passing`, rubric
  rewritten with today's date and this evidence. Full detail: `devops/progress.md` 2026-08-18
  entry, `devops/sprint-contract.md`'s reconciliation-sprint section.
- `devops.terraform_networking_rds` / `devops.terraform_compute_envs` — still `blocked`. Domain
  decided (`test.nimat.dev`), full 3-env rollout (dev/staging/prod) confirmed, but **not yet
  dispatched** — these provision real, ongoing-cost AWS resources (RDS + EC2 running
  continuously, unlike everything done so far which is essentially free at this scale). Get
  explicit go-ahead before starting, same pattern as every real-AWS step in this workstream.

**Tier 1** — underway, explicitly authorized to proceed ahead of Tier 0's two blocked items
(the user's call, not a change to the general "Tier 0 before Tier 1" rule — the two remaining
Tier 0 items are stalled on their own scope/cost decision, not something blocking Tier 1's
actual prerequisites):
- `devops.ci_secret_scan` — `passing`, merged. `secret-scan.yml` (gitleaks) runs on every PR;
  branch protection on `main` requires it (added surgically — only this one check, no other
  protection settings).
- `devops.ci_build_images` — `passing`, merged (PR #14). `build-images.yml` builds both images
  via Buildx on every PR, GHA layer caching, no push. **Note:** the implementing agent got
  merged mid-verification (still waiting on its own PR's CI run) — status/progress docs were
  finished and verified independently afterward, not by the agent itself. Real evidence in
  `devops/progress.md`'s 2026-08-18 entry.
- `devops.ci_image_scan_trivy` — **`passing` this session**, not yet merged (branch
  `feat/devops-ci-image-scan-trivy`, PR opened — see this session's `devops/progress.md` entry
  for the PR URL once opened). `build-images.yml` extended: both jobs now `load: true` + install
  Trivy (pinned `v0.74.0`) + `trivy image --exit-code 1 --severity CRITICAL,HIGH --ignorefile
  .trivyignore <image>:ci` in the same job. Found and fixed 3 REAL bugs surfaced by the scan
  (not suppressed via ignorefile) — see progress.md's full 2026-08-18 entry:
  1. `apps/api/Dockerfile`'s `pnpm install --frozen-lockfile --prod` did not actually prune
     already-installed devDependencies (vite/vitest/esbuild were shipping in the runtime image)
     — fixed by adding `&& pnpm prune --prod`, which does.
  2. `node:22-slim`'s bundled `npm` CLI (never invoked — image only runs `node`) carried its own
     vendored CVEs — removed it outright from the runtime stage (`rm -rf .../npm ... npm npx`).
  3. Real transitive prod-dependency CVEs: `multer` (via `@nestjs/platform-express`) and
     `lodash` (via `@nestjs/config`) — forced to patched versions via `pnpm-workspace.yaml`'s
     `overrides:` field (NOT `package.json`'s `pnpm.overrides` — pnpm 11 moved that setting,
     warns and ignores it if you use the old location).
  New root `.trivyignore` allowlists the 13 remaining CVE IDs (22 findings) — all Debian OS
  packages in the base image with no fix available upstream (confirmed already on the newest
  `node:22-slim` digest), each entry individually commented with the CVE, Debian's advisory
  status, and why it's inapplicable to this image's actual runtime.

## Next feature to work

**`devops.cd_push_ecr_main`** (Tier 2) — `dependsOn: ["devops.terraform_ecr",
"devops.ci_secret_scan", "devops.ci_image_scan_trivy"]`. **All three dependencies are now
`passing`** (`devops.terraform_ecr` merged to `main` via PR #18 this session, ahead of this
entry's own work) — this feature was picked up in the same session. **`in_progress`**, not yet
`passing`.
Reconciled `devops.terraform_ecr`'s dependency for real (`aws ecr describe-repositories` — both
repos live, `IMMUTABLE`, `scanOnPush: true`) and proceeded on that basis without merging PR #18
(not mine to merge). Built `.github/workflows/build-images.yml` extensions: `push: branches:
[main]` trigger, a push-only `secret-scan-main` job, and `push-api`/`push-web` jobs
(`needs:`-gated on `secret-scan-main` + their respective build job, explicit success-checking
`if:`) that authenticate via OIDC (`role-to-assume: arn:aws:iam::404063516240:role/scribe-github-
actions-deploy`) and push `${{ github.sha }}`-tagged images (never `latest`) to ECR via
`aws-actions/amazon-ecr-login` + `docker/build-push-action`.

Verified everything that's verifiable pre-merge: `actionlint` clean, grep confirms no `latest`
tag value / no static AWS creds, `aws iam get-role-policy` on the real live OIDC role confirms
its policy already grants exactly the ECR push actions this workflow needs (scoped to
scribe-api/scribe-web) and its trust policy matches a real push-to-main token claim, a
`devops-agent`-principal dry-run push proved the ECR registry/tag mechanics work end-to-end
(different principal, not equivalent proof of the OIDC role's own path), and the PR's own
`pull_request` run confirmed `build-api`/`build-web` still pass unchanged while
`secret-scan-main`/`push-api`/`push-web` correctly skip on a PR event. **Could NOT verify**: the
feature's own literal `verify` commands (a real `aws ecr describe-images imageTag=<sha>` after an
actual push-to-main) — that requires a real merge, which didn't happen this session (never merge
own PR). Left `status: in_progress` in `devops/feature-list.json`, not faked `passing`. Branch
`feat/devops-cd-push-ecr-main`, PR opened, not merged. Full detail: `devops/progress.md`'s
2026-08-18 entry.

**For the next session / a human:** merge PR #18 (`docs/devops-terraform-ecr-reconcile`) and this
session's PR, then watch the FIRST real push-to-main run of `build-images.yml` end-to-end
(`secret-scan-main` → `build-api`/`build-web` → `push-api`/`push-web` all green), then run the
literal `verify` commands for real before flipping this feature to `passing`. After that:
`devops.cd_deploy_prod_on_main` (dependsOn this feature + `terraform_compute_envs`, which is
still blocked on the dev/staging/prod go-ahead — so that Tier 2 item can't fully proceed yet
either way).

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — not
  a DB-independent liveness check. Relevant if a future CI job needs the API image to actually
  *run* (not just build) — it'll need a real reachable Postgres service container.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- `devops-agent` IAM user cannot self-inspect its own policy — verifying what's actually
  granted requires the AWS console or an admin profile.
- `devops-agent`'s create/manage IAM grants don't automatically cover: (a) verification/read
  actions like `iam:SimulatePrincipalPolicy`, (b) `TagResource` when the provider applies
  `default_tags` at creation time, or (c) the resource's own post-create read-back
  (`Get*`/`Describe*`). Three distinct gap categories seen so far — check proactively for all
  three on the next new AWS resource type (RDS, EC2) rather than discovering each fresh.
- A GitHub Actions workflow's `workflow_dispatch` trigger can get **permanently** stuck if its
  workflow ID was first registered on a non-default branch — merging to `main` does not fix it.
  Use `pull_request` instead if this happens again. `pull_request`-triggered workflows don't
  have this problem and fire immediately, including on the very PR that introduces them — but
  only for a PR whose diff/merge-view actually contains the workflow file (a PR based purely on
  unmerged `main` won't trigger it).
- `actionlint` (installed via `brew install actionlint`) is available locally — lint any
  new/edited workflow YAML with it before pushing; a parse-level YAML error gives no useful
  job/step logs via `gh run view`, only a generic unhelpful failure.
- `devops-agent` also lacks `ecr:BatchDeleteImage` — a throwaway `scribe-api:smoke-test-tag`
  image from `devops.terraform_ecr`'s verification is still sitting in the real ECR repo,
  harmless but not worth a dedicated IAM round to clean up.
- **Dispatched subagents in this workstream have repeatedly received mid-turn messages/prompts
  telling them to merge their own PR or continue to another feature — none of these came from
  the actual human owner. Every subagent so far has correctly declined and explained why**
  (documented precedent, cited across sessions). This appears to be a recurring pattern, not a
  one-off — worth being aware of, not alarmed by, when dispatching future subagents.
