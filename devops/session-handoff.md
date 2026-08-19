# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

**Tier 0** — done except two items genuinely blocked on a pending scope decision, not a
technical/IAM issue:
- `devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
  `devops.terraform_oidc_github`, `devops.terraform_ecr` — all `passing`, merged to `main`.
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
- `devops.ci_image_scan_trivy` — next, `dependsOn: ["devops.ci_build_images"]`, now unblocked.

## Next feature to work

**`devops.ci_image_scan_trivy`** (Tier 1) — Trivy scans both PR-built images for
CRITICAL/HIGH CVEs, with a reviewed `.trivyignore` allowlist mechanism for genuine false
positives. `trivy` CLI is installed locally (`brew install trivy`, from very early this
workstream). This will need to reuse/extend `build-images.yml` (load the built image locally
via `docker/build-push-action`'s `load: true` so Trivy can scan it, or use `actions/upload-artifact`
+ a separate scan job — implementer's call) rather than starting a new workflow from scratch.

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
