# Sprint Contract — DevOps / CI-CD workstream

An agreement written **before** a devops sprint starts and checked **after** it ends. A
"sprint" here = one feature from `devops/feature-list.json` (they're intentionally large —
provisioning real infra isn't always a one-sitting task, so a sprint may legitimately span
sessions; `devops/session-handoff.md` carries it across).

Its job is the same as the repo-root `sprint-contract.md`: pin down what "done" means **up
front**, including exactly which `verify` commands will be run for real, so the sprint can't
quietly get marked `passing` on a plan-only or mocked basis.

**How to use:**

- **Sprint start:** fill in _Active sprint_ and state it back before writing any Terraform/
  Dockerfile/workflow. If you can't name the exact `verify` commands you'll run against the real
  target, the task isn't understood yet — clarify first.
- **Sprint end:** score the work against `devops/evaluator-rubric.md`. If it passes (or an
  accepted CONDITIONAL), fold the outcome into `devops/progress.md` and overwrite this file for
  the next sprint.

---

## Prior sprint outcome — devops.dockerfile_web (2026-08-18)

All four Done conditions met with real evidence; all four literal `verify` commands run
end-to-end and green (build exit 0, container stays up, `curl -f / | grep -qi 'AI Clinical
Scribe'` matched, clean `docker stop`); extra evidence for "non-root" (`id` -> `uid=101(nginx)`)
and "no source/node_modules shipped" (`find` inside the container for both -> empty), plus
`nginx -t` + a read-through confirming the templated `/api/*` config mirrors
`infra/nginx.conf`'s rewrite/proxy_buffering rules (not curl-tested — no linked API container
in this sprint's smoke test). No static AWS creds, no `latest` tag, no-touch zone respected
(`infra/nginx.conf` read-only, nothing under `apps/*/src` or `libs/**` touched). Full detail:
`devops/progress.md` (2026-08-18 entry) and `devops/session-handoff.md`. Status flipped to
`passing` in `devops/feature-list.json`, committed on `feat/devops-dockerfile-web`.

## Active sprint

**Feature(s):** _none yet — both Tier 0 Dockerfile items are now `passing` (each on its own
unmerged branch/PR, see `devops/session-handoff.md`). Next real candidate:
`devops.terraform_backend` (S3 + DynamoDB state backend) — needs real AWS provisioning
(confirmed available via the `devops-agent` profile this session), so get explicit user
go-ahead before starting, unlike the Dockerfile items which were fully local._

**Goal (one sentence):** _—_

**Tier:** _—_ · **Branch:** _—_

### Context (why this is the next real gap)

_—_

### The concrete approach (decided up front)

_—_

### Explicitly OUT of scope (do not touch this sprint)

- Anything under `apps/api/src/**`, `apps/web/src/**`, `libs/**` — permanent no-touch zone for
  this entire workstream (devops/AGENTS.md), not just this sprint.
- Any devops feature not named above, even if adjacent/tempting.

### Done conditions (testable — copy verbatim from the feature's `acceptance` in
`devops/feature-list.json`)

- [ ] _—_

### Invariants that must still hold (devops/AGENTS.md non-negotiables + root AGENTS.md §2)

- [ ] No static AWS credentials introduced.
- [ ] No `latest` image tag introduced.
- [ ] No-touch zone respected (`git diff` confirms nothing under `apps/*/src` or `libs/**`).
- [ ] _feature-specific invariant, if any — e.g. RDS still private, SSE streaming still works_

### Verification plan (the exact `verify` commands from `devops/feature-list.json`, and what
counts as evidence for each)

- [ ] _—_

### Definition of done

- [ ] Every _Done condition_ checked with evidence from the real target
- [ ] Every `verify` command actually run, output recorded
- [ ] `devops/evaluator-rubric.md` scored by a separate subagent/session — PASS or accepted
      CONDITIONAL
- [ ] `devops/feature-list.json` → `passing`; `devops/progress.md` + `devops/session-handoff.md`
      updated
