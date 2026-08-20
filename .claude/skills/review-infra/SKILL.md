---
name: review-infra
description: Review, fix, and prep for merge any pending devops/infra work — runs /code-review plus devops/AGENTS.md's non-negotiables as a harness-compliance pass, then stops for human merge approval. Use when there's new/unreviewed devops/Terraform/CI-CD work, or the user asks to review infra changes.
---

Domain config for the shared procedure in `.claude/skills/review-shared/PROCEDURE.md` — read that
first, this file only names the scope and domain-specific checks.

**Scope note:** like `devops-request-grant`, this skill's own operational state (`init.sh`, `feature-list.json`, `session-handoff.md`, `progress.md`, `graph.md`) lives only under `.claude/skills/review-infra/` — Claude Code specific, on purpose (its dispatch mechanics have no direct equivalent in every agent tool). `review-shared/PROCEDURE.md` is the authoritative procedure; this file and its state are one tool's implementation of it.

## Scope

`devops/**`, `infra/**` (Terraform, nginx conf, docker-compose, CI workflows). Never edit
`apps/api/src/**`, `apps/web/src/**`, or `libs/**` as part of a fix here — this mirrors
`devops/AGENTS.md`'s own no-touch zone exactly; if a fix genuinely needs an application code
change, flag it rather than crossing the boundary.

## Harness-compliance pass (in addition to `/code-review`)

Check the diff against `devops/AGENTS.md`'s non-negotiables directly — this domain already has
its own detailed contract, don't re-derive it, just verify against it:
- No static AWS credentials anywhere — OIDC only.
- Never the AWS account root user, ever, including for this review cycle's own verification
  commands (`AWS_PROFILE=devops-agent`, never `default`/root).
- Never `latest` as an image tag.
- `terraform apply` only ever runs from CI on merge to `main` — flag any local apply found in a
  diff/PR description that isn't already documented/justified per the established Tier-0-bootstrap
  exception pattern.
- A feature's `verify` commands must have actually been run for real — a `devops/feature-list.json`
  status flip to `passing` without real command output attached is itself a finding.
- If the PR touches AWS permission grants, confirm it followed `devops/AGENTS.md`'s "Requesting
  an AWS permission grant" procedure (dispatch a subagent, MFA-gated, never root) rather than an
  ad-hoc workaround.

## Toolchain (`init.sh` checks)

`git`, `gh`, `docker`, `terraform`, `aws`, `trivy`, `jq`, `python3` — mirrors `devops/init.sh`,
including its hard root-credential breakpoint (this skill refuses to proceed if any in-play AWS
credential resolves to the account root user, same rule, same reason).

## `feature-list.json`

Tracks review cycles for this domain — see `review-shared/PROCEDURE.md`'s schema section. This is
separate from `devops/feature-list.json` (which tracks devops *features*, not review cycles) and
from `devops-request-grant/feature-list.json` (which tracks IAM *grants*) — three different logs,
don't conflate them.
