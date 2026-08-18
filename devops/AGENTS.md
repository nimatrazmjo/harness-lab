# devops/AGENTS.md — DevOps / CI-CD workstream

> **Scoped, on-demand harness contract.** This file lives in `devops/` specifically so it only
> loads when an agent is working in this directory (invoked via the `/devops` skill, or a
> subagent dispatched into a worktree) — never on an ordinary product-coding session. The
> repo-root `AGENTS.md` stays a one-line pointer to here; don't move this detail back there.
>
> - Claude Code reads `devops/CLAUDE.md`, which imports this file the same way the root does.
> - **No-touch zone: this workstream never edits `apps/api/src/**`, `apps/web/src/**`, or
>   `libs/**`.** DevOps changes infrastructure, containers, and pipelines — not product code. If
>   a devops item seems to require an application code change (e.g. a Dockerfile needs a new
>   `/health` route that doesn't exist yet), stop and flag it in `devops/session-handoff.md`
>   rather than crossing the boundary.

**Files in this directory** (mirrors the repo-root harness, scoped to this workstream):

```
init.sh                  # toolchain gate: docker/terraform/aws/trivy/gh present + JSON valid
feature-list.json        # the 16-item, tier-ordered plan (this workstream's source of truth)
clean-state-checklist.md # start-clean / leave-clean gates, run at both ends of a /devops session
sprint-contract.md       # per-feature "done" agreed BEFORE coding — includes exact verify cmds
evaluator-rubric.md      # adversarial scorecard applied AFTER coding (separate eval pass)
progress.md              # rolling log — durable, dated entries
session-handoff.md       # warm baton-pass — overwritten each session, read first to resume
```

## Session protocol

1. **Resume & verify toolchain:** read `devops/session-handoff.md`, then run `bash
   devops/init.sh` (checks docker/terraform/aws/trivy/gh are present, `devops/feature-list.json`
   parses, and reports whether AWS credentials resolve). Fix the toolchain before proceeding if
   it fails. Then complete the rest of the _Start clean_ gate in
   `devops/clean-state-checklist.md`.
2. **Orient:** read `devops/progress.md` (where this workstream has been) and
   `devops/feature-list.json` (what's next, by tier).
3. **Contract before code:** fill in `devops/sprint-contract.md`'s _Active sprint_ section —
   name the exact `verify` commands you'll run — before writing any Terraform/Dockerfile/
   workflow. Work the next `failing` item, lowest-numbered tier first. Don't start Tier 1 until
   Tier 0 is `passing` (Tier 0 is the auth/registry foundation everything else authenticates
   through — nothing else is trustworthy without it).
4. **Work:** implement the thinnest slice that satisfies the item's `acceptance`, then run every
   command in its `verify` array for real. A feature only becomes `passing` when `verify`
   actually succeeds against the real target (real AWS) — not when it "looks right" or a mock
   stands in. If `verify` can't run yet (no AWS account access), leave status `blocked` and say
   why.
5. **Evaluate after:** score the sprint against `devops/evaluator-rubric.md` — ideally via a
   separate subagent that didn't write the code, same reasoning as the root repo's rubric.
6. Branch + PR per feature, same convention as the root repo. **Never commit to `main`.**
7. Update the feature's `status` in `devops/feature-list.json` in the same commit.
8. **Hand off:** run the _Leave clean_ gate in `devops/clean-state-checklist.md`, overwrite
   `devops/session-handoff.md` with a fresh snapshot, prepend a dated entry to
   `devops/progress.md`, and overwrite `devops/sprint-contract.md` for the next sprint.

## What this workstream is

Containerizing the app (`apps/api`, `apps/web`), provisioning AWS infra via Terraform, and a
GitHub Actions CI/CD pipeline: secret scan → build → Trivy vulnerability scan → (on main only)
OIDC-authenticated push to ECR with immutable SHA tags → SSM-driven deploy → a separate
rollback workflow → a manual multi-environment (dev/staging/prod) dispatch workflow. Full
design rationale and the tiered plan live in `devops/feature-list.json`.

**Architecture decision — Docker Compose on EC2, not ECS/Fargate.** The repo's existing
`docs/ARCHITECTURE.md:54` and `infra/DEPLOY.md` commit to EC2+nginx specifically because
nginx's `proxy_buffering off` is what makes the SSE note-streaming feature
(`scribe.generate_stream`, already `passing`) work. Don't migrate to a container orchestrator
without re-litigating that — an ALB in front of ECS would need the streaming behavior
re-verified for no real benefit. Deploys/rollbacks run over **AWS SSM Run Command** (IAM-scoped,
no SSH keys, no bastion), not a scheduler's rolling-update primitive.

## Non-negotiables (in addition to the root AGENTS.md §2 invariants, which still apply in full)

- **No static AWS credentials, anywhere, ever.** GitHub Actions authenticates via OIDC
  (`devops.terraform_oidc_github`) — no `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in any
  workflow file or GitHub secret.
- **Never the AWS account root user, ever — enforced as a hard breakpoint in `devops/init.sh`.**
  `bash devops/init.sh` runs first in every `/devops` session and refuses to pass (exit 1, with
  an explicit message) if resolved credentials match the root ARN pattern
  (`arn:aws:iam::<account>:root`). Do not remove/bypass that check — replace the credentials
  with a scoped IAM user/role instead. This applies to local credentials just as much as
  anything CI-facing.
- **Never `latest` as an image tag.** Every pushed image is tagged with its git SHA. ECR repos
  have `imageTagMutability = IMMUTABLE` so this is enforced, not just conventional.
- **`terraform apply` only ever runs from CI on merge to main.** Never apply from a local
  machine against shared/real infra state.
- A feature's `verify` commands are the actual test. Don't mark something `passing` because the
  Terraform/YAML "looks correct" — run it.

## Commands

```bash
cd devops/terraform && terraform init          # after devops.terraform_backend exists
terraform plan                                  # review before every apply
terraform apply                                 # CI-only in practice; local only for iteration
docker build -f apps/api/Dockerfile .            # from repo root (build context needs both apps)
docker build -f apps/web/Dockerfile .
trivy image --exit-code 1 --severity CRITICAL,HIGH <image>
gh workflow run <name>.yml -f key=value          # manual dispatch workflows
```

## Definition of done (per devops feature)

Same shape as the root repo's: acceptance criteria met, every `verify` command actually run and
green, no invariant violated (root §2 + this file's non-negotiables), `status` flipped and
committed on a branch/PR, `devops/progress.md` updated with what changed and the next item.
