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
  github_org_repo = "nimatrazmjo/harness-lab"
  ecr_repo_names  = ["scribe-api", "scribe-web"]
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
    # `repo:<org>/<repo>:ref:refs/heads/main` covers push-to-main; `repo:<org>/<repo>:pull_request`
    # covers PR-triggered runs. Deliberately NOT `repo:*` and NOT a bare `repo:<org>/<repo>:*`
    # wildcard that would also cover arbitrary branches/tags/environments.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${local.github_org_repo}:ref:refs/heads/main",
        "repo:${local.github_org_repo}:pull_request",
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
