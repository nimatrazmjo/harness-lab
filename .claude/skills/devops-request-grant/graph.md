# devops-request-grant — Graphs

Two diagrams. Section 1 is static (the architecture itself, hand-maintained). Section 2 is
auto-generated from `feature-list.json` by `scripts/generate-feature-graph.py` — regenerate it
with the command below rather than hand-editing; anything between the `GENERATED` marker
comments gets overwritten on the next run.

## 1. Identity / trust chain (static — update only if the architecture itself changes)

```mermaid
flowchart TB
    root["Root user<br/>(retired — used once, never again)"]
    nimat["nimat-admin<br/>(human's IAM user)<br/>only permission: sts:AssumeRole"]
    mfa{{"Fresh MFA code<br/>(~30s valid)"}}
    grantor["iam-grantor-devops-agent<br/>(assumed role)<br/>scoped to 2 policy ARNs"]
    infra["scribe-devops-infra<br/>(ongoing operational grants)"]
    bootstrap["scribe-devops-bootstrap<br/>(one-time bootstrap grants)"]
    boundary["devops-agent-boundary<br/>(permissions boundary — hard ceiling)"]
    agent["devops-agent<br/>(day-to-day scoped IAM user)"]
    trail["CloudTrail -> EventBridge -> SNS -> email<br/>(independent notification, not agent-managed)"]

    root -- "created once" --> nimat
    root -- "created once" --> grantor
    nimat -- "assumes, with" --> mfa
    mfa --> grantor
    grantor -- "create-policy-version --set-as-default" --> infra
    grantor -- "create-policy-version --set-as-default" --> bootstrap
    infra -- "attached to" --> agent
    bootstrap -- "attached to" --> agent
    boundary -- "caps effective max of" --> agent
    infra -. "any write fires" .-> trail
    bootstrap -. "any write fires" .-> trail
    boundary -. "any write fires" .-> trail
```

## 2. Grant → unblocked-feature dependency graph (auto-generated)

Regenerate after any change to `feature-list.json`:

```bash
python3 scripts/generate-feature-graph.py \
  .claude/skills/devops-request-grant/feature-list.json \
  --out .claude/skills/devops-request-grant/graph.md \
  --relation blocks \
  --external devops/feature-list.json \
  --title "Grant requests -> unblocked devops features"
```

<!-- GENERATED:feature-graph:BEGIN (do not edit by hand -- run scripts/generate-feature-graph.py) -->

### Grant requests -> unblocked devops features

_1 entries._

```mermaid
flowchart LR
    n_grant_2026_08_19_01_ssm_senddocument["grant-2026-08-19-01-ssm-senddocument"]
    n_ext_devops_terraform_networking_rds["devops.terraform_networking_rds<br/>Terraform: VPC + private RDS (unblocks infra.rds_postgres_private)"]
    n_grant_2026_08_19_01_ssm_senddocument -- "denied" --> n_ext_devops_terraform_networking_rds
    style n_grant_2026_08_19_01_ssm_senddocument fill:#ffcdd2,stroke:#c62828
```

<!-- GENERATED:feature-graph:END -->
