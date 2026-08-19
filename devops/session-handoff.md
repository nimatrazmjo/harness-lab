# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

**Tier 0** — done except two items genuinely blocked on a pending scope decision, not a
technical/IAM issue:
- `devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
  `devops.terraform_oidc_github` — all `passing`, merged to `main`.
- `devops.terraform_ecr` — **status discrepancy, unresolved, flagged this session**: this file
  previously said `passing`/merged, but `devops/feature-list.json`'s actual `status` field reads
  `blocked` (with a detailed rubric note about an `ecr:TagResource` IAM gap). Did not
  investigate which is correct — out of scope for this session's feature
  (`devops.ci_image_scan_trivy`) — but reconcile this (check real AWS state via `aws ecr
  describe-repositories --repository-names scribe-api scribe-web`) before starting
  `devops.cd_push_ecr_main`, which `dependsOn` it.
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
"devops.ci_secret_scan", "devops.ci_image_scan_trivy"]`. The latter two are now `passing`;
`devops.terraform_ecr`'s actual status needs reconciling first (see the discrepancy noted above)
before this is safely startable — if the real ECR repos exist and are healthy, flip
`feature-list.json` to match reality and proceed; if they don't, this feature is still genuinely
blocked on the same IAM gap `devops/manual.md` Step 9 describes.

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
