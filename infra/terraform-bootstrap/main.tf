# Bootstrap: Terraform remote state backend (S3 + DynamoDB)
# ============================================================
# Chicken-and-egg problem: infra/terraform/ (the "real" config) wants to store its state in
# S3 with DynamoDB locking, but Terraform can't use a remote backend to create the very
# bucket/table that backend depends on. So this small, standalone config creates just those
# two resources, using LOCAL state (gitignored — see infra/terraform-bootstrap/.gitignore).
#
# This is applied ONCE, manually, by a human/agent with real AWS access — documented as the
# explicit exception to devops/AGENTS.md's "terraform apply only ever runs from CI on merge to
# main" rule (see devops/progress.md for the dated justification). It is not meant to be
# re-applied routinely; if the bucket/table ever need to change, edit here and re-apply by hand.
#
# devops.terraform_backend (devops/feature-list.json, tier 0).

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Intentionally local state — this config bootstraps the remote backend, it can't use it.
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "ai-clinical-scribe"
      ManagedBy = "terraform-bootstrap"
      Purpose   = "terraform-remote-state"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  state_bucket_name = "scribe-terraform-state-${data.aws_caller_identity.current.account_id}"
  lock_table_name    = "scribe-terraform-locks"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = local.state_bucket_name

  # Guard against an accidental `terraform destroy` wiping out all environments' state.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = local.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

output "state_bucket_name" {
  description = "S3 bucket that infra/terraform/backend.tf points at."
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table_name" {
  description = "DynamoDB table that infra/terraform/backend.tf points at for state locking."
  value       = aws_dynamodb_table.terraform_locks.name
}
