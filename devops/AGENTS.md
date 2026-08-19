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
graph.md                 # feature dependency graph, auto-generated — see scripts/generate-feature-graph.py
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
  anything CI-facing. **Needing a new permission is not an exception to this** — see
  "Requesting an AWS permission grant" below for the actual procedure. Never ask the human to
  just run something as root; if that genuinely seems like the only option, stop and say so.
- **Never `latest` as an image tag.** Every pushed image is tagged with its git SHA. ECR repos
  have `imageTagMutability = IMMUTABLE` so this is enforced, not just conventional.
- **`terraform apply` only ever runs from CI on merge to main.** Never apply from a local
  machine against shared/real infra state.
- A feature's `verify` commands are the actual test. Don't mark something `passing` because the
  Terraform/YAML "looks correct" — run it.

## Requesting an AWS permission grant

`devops-agent` is deliberately unable to grant itself anything — it can't even list its own
attached policies (confirmed repeatedly, by design). When a task hits `AccessDenied` for
something it genuinely needs, don't ask the human to fix it with root, and don't invent a
workaround or mock. **Hand the actual grant to a dedicated subagent, then resume with
`devops-agent` once it reports back.** There is no manual-steps file and no
human-runs-the-CLI-themselves fallback — the subagent does the AWS work end to end, the human's
only involvement is supplying a live MFA code when asked. (Claude Code users:
`/devops-request-grant` drives this same flow interactively.)

**The identity chain** (set up 2026-08-19, replacing routine root use):
- `devops-agent` — the day-to-day scoped IAM user (`AWS_PROFILE=devops-agent`). Capped by a
  **permissions boundary** (`devops-agent-boundary`) — even an over-broad grant to it can't
  exceed that ceiling.
- `nimat-admin` — the human's personal IAM user, configured locally as its own AWS CLI profile.
  Its only permission is `sts:AssumeRole` on the grantor role below, and that requires a fresh
  MFA code every time. A leaked `nimat-admin` key alone can't do anything destructive.
- `iam-grantor-devops-agent` — the role `nimat-admin` assumes (MFA-gated) to actually make a
  grant. Scoped to version-bumping exactly two managed policies: `scribe-devops-infra` (ongoing
  operational grants) and `scribe-devops-bootstrap` (one-time bootstrap grants only — state
  backend, OIDC provider/role management). Can't create users/roles, can't touch billing or
  other services.
- Root — retired. Used once to create the identity chain above; never touched again for this
  workflow.
- CloudTrail → EventBridge → SNS emails the human automatically on any IAM write touching these
  identities. That, plus the grant-subagent's own report and (where it unblocks a feature) that
  feature's normal `devops/progress.md` entry, IS the audit trail now — there is no separate
  steps/log file to maintain.

**The procedure, when a task hits a genuine new-permission need:**
1. Stop the current task. Re-read the exact `AccessDenied` message and confirm it's really a
   missing grant, not a bug in the calling code (wrong resource ARN, wrong region, wrong
   profile).
2. Draft the **minimal** statement: exact actions (no `service:*`-style wildcards), exact
   resource ARNs (never `Resource: "*"` unless the action is inherently resource-less — e.g.
   `sts:GetCallerIdentity`, some `iam:Simulate*`/list calls — say so explicitly if used). Decide
   which policy it belongs on: `scribe-devops-infra` for ongoing operational work (RDS/EC2/ECR/
   SSM/etc.), `scribe-devops-bootstrap` only for genuinely one-time bootstrap actions.
3. Dispatch a **fresh subagent** (`subagent_type: "general-purpose"`, `isolation: "worktree"`,
   self-contained prompt) whose only job is applying this one grant:
   - Confirm `aws sts get-caller-identity --profile nimat-admin` resolves to
     `arn:...:user/nimat-admin` — never root.
   - Ask the human directly (a blocking question, not a chat aside) for a fresh MFA code from
     `nimat-admin`'s authenticator entry, then immediately:
     ```bash
     aws sts assume-role \
       --role-arn arn:aws:iam::404063516240:role/iam-grantor-devops-agent \
       --role-session-name grant-$(date +%s) \
       --serial-number <nimat-admin's MFA device ARN> \
       --token-code <fresh code> \
       --profile nimat-admin
     ```
     Codes are ~30s-valid — if it expires before use, ask for a fresh one rather than reusing a
     stale one.
   - Using the resulting temporary credentials:
     ```bash
     aws iam create-policy-version \
       --policy-arn arn:aws:iam::404063516240:policy/<target-policy> \
       --policy-document file://statement.json \
       --set-as-default
     ```
   - Verify the new version is actually the default (`list-policy-versions` /
     `get-policy-version`) — don't just trust the API call returning success.
   - Report back exactly what changed: which policy, which statement, confirmation it's live.
4. Once the subagent reports success, **hand back to `devops-agent`** — resume the original task
   with `AWS_PROFILE=devops-agent` and **re-verify by re-attempting the actual blocked operation
   for real**. Don't trust the grant subagent's report alone; a version bump landing on the
   wrong policy, not being `--set-as-default`'d, or the permissions boundary capping it are all
   real failure modes already seen in this workstream. If it's still denied, report the exact
   new error and repeat from step 2 with corrected scope — don't guess or retry blindly.
5. Never widen a request beyond the literal minimal fix needed right now. If the grantor role's
   own scope genuinely can't cover what's needed (e.g. a brand-new policy, a new IAM user), the
   subagent should say so explicitly and stop — that's a bigger decision for the human, not
   something to route around.

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
