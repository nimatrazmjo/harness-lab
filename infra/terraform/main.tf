# Real AWS infrastructure for the AI Clinical Scribe Platform.
#
# devops/feature-list.json Tier 0 items land here as they're implemented:
#   - devops.terraform_oidc_github  — IAM OIDC provider + role for GitHub Actions (THIS FILE)
#   - devops.terraform_ecr          — ECR repos (scribe-api, scribe-web)
#   - devops.terraform_networking_rds   — VPC + private RDS (blocked on later go-ahead)
#   - devops.terraform_compute_envs     — EC2 + nginx + TLS per environment (blocked)

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# devops.terraform_oidc_github
#
# GitHub Actions authenticates to AWS via OIDC (aws-actions/configure-aws-credentials) instead
# of static access keys. Trust is scoped to this specific repo (nimatrazmjo/harness-lab) and to
# `main` pushes + pull_request events only — not org-wide, not any-repo.
# ---------------------------------------------------------------------------

locals {
  # This repo's actual OIDC subject-claim prefix, confirmed via
  # `gh api repos/nimatrazmjo/harness-lab/actions/oidc/customization/sub` — NOT the plain
  # "repo:nimatrazmjo/harness-lab" format most AWS OIDC tutorials assume. GitHub's default sub
  # claim for this account bakes in immutable owner_id/repo_id (@3712526 / @1332166375) even
  # with no explicit customization configured ("use_default": true, "use_immutable_subject":
  # false, yet the reported sub_claim_prefix already has the IDs). These IDs are stable across
  # repo renames/transfers (that's the point of immutable IDs) so hardcoding them here is safe,
  # but if this Terraform is ever forked to a different GitHub account/repo, re-run that `gh
  # api` command and update this value — a plain "repo:owner/repo" trust condition will silently
  # never match and every OIDC role-assumption will fail with a generic AccessDenied.
  github_oidc_sub_prefix = "repo:nimatrazmjo@3712526/harness-lab@1332166375"
  ecr_repo_names         = ["scribe-api", "scribe-web"]
}

# GitHub's OIDC token endpoint. Fetch the TLS root CA thumbprint dynamically (Terraform's
# documented pattern for this resource) instead of hardcoding it — hardcoded thumbprints go
# stale silently on GitHub's cert-chain rotations and are easy to mistype.
data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    data.tls_certificate.github_actions.certificates[0].sha1_fingerprint,
  ]
}

data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    sid     = "GithubActionsOidcAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Scoped to THIS repo only, and only for: pushes to main, and any pull_request event.
    # covers PR-triggered runs. Deliberately NOT `repo:*` and NOT a bare prefix-only
    # wildcard that would also cover arbitrary branches/tags/environments.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "${local.github_oidc_sub_prefix}:ref:refs/heads/main",
        "${local.github_oidc_sub_prefix}:pull_request",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "scribe-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json

  # Federated OIDC sessions are short-lived per-workflow-run tokens already; this caps how long
  # any assumed session can be used even within a single run.
  max_session_duration = 3600
}

# Least-privilege permissions policy: ECR push/pull scoped to the two named repos, SSM
# SendCommand scoped to deploy-tagged instances, EC2/ECS describe (read-only, unavoidably
# broad-resource by AWS API design) for smoke checks. No `*` resource on a mutating action.
data "aws_iam_policy_document" "github_actions_deploy_permissions" {
  statement {
    sid    = "EcrAuthToken"
    effect = "Allow"
    # ecr:GetAuthorizationToken has no resource-level permissions in AWS IAM — it must be "*".
    # This action alone grants no ability to push/pull; that's gated per-repo below.
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushPullScribeRepos"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:ListImages",
    ]
    resources = [
      for name in local.ecr_repo_names :
      "arn:aws:ecr:us-east-1:${data.aws_caller_identity.current.account_id}:repository/${name}"
    ]
  }

  statement {
    sid       = "SsmSendCommandDeployTagged"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ec2:us-east-1:${data.aws_caller_identity.current.account_id}:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "ssm:resourceTag/deploy"
      values   = ["true"]
    }
  }

  statement {
    sid    = "SsmSendCommandDocument"
    effect = "Allow"
    # SendCommand targets both an instance ARN and a document ARN; AWS-owned documents
    # (AWS-RunShellScript etc.) live under the `aws` account namespace, not this account's.
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:us-east-1::document/AWS-RunShellScript"]
  }

  statement {
    sid    = "SsmCommandStatusReadOnly"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:DescribeInstanceInformation",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "SmokeCheckDescribeOnly"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "ec2:DescribeInstanceStatus",
      "ecs:DescribeClusters",
      "ecs:DescribeServices",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy_permissions" {
  name   = "scribe-github-actions-deploy-permissions"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy_permissions.json
}

output "github_actions_oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github_actions.arn
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}

# ---------------------------------------------------------------------------
# devops.terraform_ecr
#
# ECR repositories for scribe-api and scribe-web. Tag immutability is ON — a pushed tag can
# never be overwritten, which is what makes "always deploy by git SHA, never `latest`"
# actually enforced rather than just a convention agents are supposed to remember. Native
# ECR scan-on-push is defense-in-depth alongside the (separate, later) Trivy CI gate. Untagged
# images (orphaned after a repush/cleanup) expire after 7 days via lifecycle policy.
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "scribe" {
  for_each = toset(local.ecr_repo_names)

  name                 = each.value
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "scribe_expire_untagged" {
  for_each   = aws_ecr_repository.scribe
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "ecr_repository_urls" {
  value = { for name, repo in aws_ecr_repository.scribe : name => repo.repository_url }
}

# ---------------------------------------------------------------------------
# devops.terraform_networking_rds
#
# One shared VPC with per-environment (dev/staging/prod) public+private subnet pairs, a reserved
# "compute" SG per env (EC2 attaches to it in devops.terraform_compute_envs, next feature — not
# this one), an RDS SG per env allowing 5432 only from that env's compute SG (source = SG
# reference, never a CIDR — see [RDS-PRIVATE] in the root AGENTS.md §2), and one real db.t4g.micro
# Postgres 16 RDS instance per env — PubliclyAccessible=false, single-AZ, gp3 20GB, master
# credentials via RDS-native manage_master_user_password (backed by Secrets Manager; the password
# itself never appears in Terraform state or this codebase). Topology/sizing rationale: see
# devops/sprint-contract.md's "Active sprint — devops.terraform_networking_rds" section.
#
# One shared VPC (not per-env VPCs) — simpler option, no doc opinion either way. One parameterized
# for_each over `scribe_environments` in a single state (NOT Terraform workspaces) — the VPC is
# shared across envs and all 3 RDS instances must be describable in one pass.
# ---------------------------------------------------------------------------

locals {
  scribe_azs = ["us-east-1a", "us-east-1b"]

  scribe_environments = {
    dev = {
      public_subnet_cidrs  = ["10.30.0.0/24", "10.30.1.0/24"]
      private_subnet_cidrs = ["10.30.10.0/24", "10.30.11.0/24"]
    }
    staging = {
      public_subnet_cidrs  = ["10.30.20.0/24", "10.30.21.0/24"]
      private_subnet_cidrs = ["10.30.30.0/24", "10.30.31.0/24"]
    }
    prod = {
      public_subnet_cidrs  = ["10.30.40.0/24", "10.30.41.0/24"]
      private_subnet_cidrs = ["10.30.50.0/24", "10.30.51.0/24"]
    }
  }

  # Flattened {"<env>-<az_index>" => {env, az, cidr}} maps — for_each needs a map, not a nested
  # structure, and this keeps each subnet's identity stable across plans regardless of ordering.
  scribe_public_subnets = merge([
    for env, cfg in local.scribe_environments : {
      for idx, az in local.scribe_azs :
      "${env}-${idx}" => {
        env  = env
        az   = az
        cidr = cfg.public_subnet_cidrs[idx]
      }
    }
  ]...)

  scribe_private_subnets = merge([
    for env, cfg in local.scribe_environments : {
      for idx, az in local.scribe_azs :
      "${env}-${idx}" => {
        env  = env
        az   = az
        cidr = cfg.private_subnet_cidrs[idx]
      }
    }
  ]...)
}

resource "aws_vpc" "scribe" {
  cidr_block           = "10.30.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "scribe-vpc" }
}

# Only used by future EC2 instances (public subnets need egress to the internet for image
# pulls/SSM); private (RDS-only) subnets deliberately get no route to this at all.
resource "aws_internet_gateway" "scribe" {
  vpc_id = aws_vpc.scribe.id

  tags = { Name = "scribe-igw" }
}

resource "aws_subnet" "public" {
  for_each = local.scribe_public_subnets

  vpc_id            = aws_vpc.scribe.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  # Deliberately NOT map_public_ip_on_launch = true: that attribute requires a follow-up
  # ec2:ModifySubnetAttribute call devops-agent isn't granted (a new IAM gap, documented in
  # devops/manual.md) — and it isn't actually needed here. devops.terraform_compute_envs (next
  # feature) can request a public IP per-instance at launch (`associate_public_ip_address = true`
  # on aws_instance) without the subnet-level auto-assign, so this avoids the gap entirely rather
  # than requiring a new grant for a cosmetic convenience.

  tags = {
    Name        = "scribe-${each.value.env}-public-${each.value.az}"
    Environment = each.value.env
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  for_each = local.scribe_private_subnets

  vpc_id            = aws_vpc.scribe.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = {
    Name        = "scribe-${each.value.env}-private-${each.value.az}"
    Environment = each.value.env
    Tier        = "private"
  }
}

resource "aws_route_table" "public" {
  for_each = local.scribe_environments

  vpc_id = aws_vpc.scribe.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.scribe.id
  }

  tags = { Name = "scribe-${each.key}-public-rt", Environment = each.key }
}

# No default route — RDS never needs outbound internet, and this deliberately avoids a NAT
# gateway (the single largest potential cost item in this feature). Only the VPC's own local
# route (implicit, not declared) applies here.
resource "aws_route_table" "private" {
  for_each = local.scribe_environments

  vpc_id = aws_vpc.scribe.id

  tags = { Name = "scribe-${each.key}-private-rt", Environment = each.key }
}

resource "aws_route_table_association" "public" {
  for_each = local.scribe_public_subnets

  subnet_id      = aws_subnet.public[each.key].id
  route_table_id = aws_route_table.public[each.value.env].id
}

resource "aws_route_table_association" "private" {
  for_each = local.scribe_private_subnets

  subnet_id      = aws_subnet.private[each.key].id
  route_table_id = aws_route_table.private[each.value.env].id
}

# Reserved for EC2 (devops.terraform_compute_envs, next feature) — created now, empty, purely so
# the RDS SG below can reference a real SG ID rather than a CIDR. The next feature attaches EC2
# instances to this same SG and adds 80/443 ingress there; not recreated/renamed.
resource "aws_security_group" "compute" {
  for_each = local.scribe_environments

  name        = "scribe-${each.key}-compute-sg"
  description = "Reserved for ${each.key} EC2 instances (devops.terraform_compute_envs). No ingress rules yet."
  vpc_id      = aws_vpc.scribe.id

  tags = { Name = "scribe-${each.key}-compute-sg", Environment = each.key }
}

resource "aws_vpc_security_group_egress_rule" "compute_all" {
  for_each = local.scribe_environments

  security_group_id = aws_security_group.compute[each.key].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "Default egress-all - no inbound rules on this SG yet"
}

resource "aws_security_group" "rds" {
  for_each = local.scribe_environments

  name        = "scribe-${each.key}-rds-sg"
  description = "Postgres access for scribe-${each.key} - 5432 only from the ${each.key} compute SG"
  vpc_id      = aws_vpc.scribe.id

  tags = { Name = "scribe-${each.key}-rds-sg", Environment = each.key }
}

# [RDS-PRIVATE]: the ONLY inbound rule, source = SG reference (never a CIDR).
resource "aws_vpc_security_group_ingress_rule" "rds_from_compute" {
  for_each = local.scribe_environments

  security_group_id            = aws_security_group.rds[each.key].id
  referenced_security_group_id = aws_security_group.compute[each.key].id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Postgres from the ${each.key} compute SG only"
}

resource "aws_vpc_security_group_egress_rule" "rds_all" {
  for_each = local.scribe_environments

  security_group_id = aws_security_group.rds[each.key].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_db_subnet_group" "scribe" {
  for_each = local.scribe_environments

  name       = "scribe-${each.key}-db-subnet-group"
  subnet_ids = [for idx, az in local.scribe_azs : aws_subnet.private["${each.key}-${idx}"].id]

  tags = { Name = "scribe-${each.key}-db-subnet-group", Environment = each.key }
}

# DEVIATION, disclosed: the original design (see devops/sprint-contract.md) used RDS-native
# manage_master_user_password so the plaintext password would never touch Terraform state at
# all. That hit a real IAM gap — devops-agent has zero KMS permissions (confirmed:
# kms:DescribeKey/kms:ListAliases both AccessDenied even on the pre-existing default
# aws/secretsmanager key), and CreateDBInstance's automatic Secrets-Manager-backed password needs
# KMS access. A new grant is required (documented in devops/manual.md) and devops-agent can't
# self-authorize it. Rather than leave all 3 RDS instances unprovisioned this session, switched to
# a Terraform-generated random_password — the standard, widely-used pattern. The password lives
# only in the remote Terraform state (S3, SSE-encrypted, versioned, never committed to git, never
# printed in this repo/docs/logs) — a real but disclosed, common tradeoff vs. the KMS-managed
# approach. Revisit once the KMS grant lands (swap back to manage_master_user_password = true,
# `terraform apply` will rotate to the RDS-managed secret cleanly).
resource "random_password" "master" {
  for_each = local.scribe_environments

  length  = 32
  special = false # avoids shell/URL-escaping surprises in a DATABASE_URL built from this later
}

# db.t4g.micro / gp3 20GB / single-AZ / 1-day backups — cost-minimizing sizing for a demo project,
# see devops/sprint-contract.md for the full rationale + rough $/mo estimate.
resource "aws_db_instance" "scribe" {
  for_each = local.scribe_environments

  identifier     = "scribe-${each.key}"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "scribe"
  username = "scribe"
  password = random_password.master[each.key].result

  db_subnet_group_name   = aws_db_subnet_group.scribe[each.key].name
  vpc_security_group_ids = [aws_security_group.rds[each.key].id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true

  tags = { Name = "scribe-${each.key}-rds", Environment = each.key }
}

output "rds_endpoints" {
  value = { for env, db in aws_db_instance.scribe : env => db.endpoint }
}

# Deliberately no output for the master password itself (random_password.master) — never
# printed by `terraform output`/plan/apply logs. Retrieve it only via `terraform state show`
# when actually needed for a real connection (e.g. this feature's own pgvector verification),
# never pasted into docs/progress logs/commits.

output "compute_security_group_ids" {
  value = { for env, sg in aws_security_group.compute : env => sg.id }
}
