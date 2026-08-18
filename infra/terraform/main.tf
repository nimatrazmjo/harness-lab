# Real AWS infrastructure for the AI Clinical Scribe Platform.
#
# No resources yet — this file exists so `terraform init` has a valid module to initialize
# against the remote backend (backend.tf). Later devops/feature-list.json Tier 0 items add
# resources here:
#   - devops.terraform_oidc_github  — IAM OIDC provider + role for GitHub Actions
#   - devops.terraform_ecr          — ECR repos (scribe-api, scribe-web)
#   - devops.terraform_networking_rds   — VPC + private RDS (blocked on later go-ahead)
#   - devops.terraform_compute_envs     — EC2 + nginx + TLS per environment (blocked)
