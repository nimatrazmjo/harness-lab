# Remote state backend for the AI Clinical Scribe Platform's real AWS infrastructure.
#
# Points at the S3 bucket + DynamoDB lock table created once, out-of-band, by
# infra/terraform-bootstrap/ (devops.terraform_backend — see its main.tf header for the
# chicken-and-egg rationale). Never hand-edit the bucket/table here without also updating
# infra/terraform-bootstrap/.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "scribe-terraform-state-404063516240"
    key            = "scribe/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "scribe-terraform-locks"
    encrypt        = true
  }
}
