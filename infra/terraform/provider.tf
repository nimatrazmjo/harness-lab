provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "ai-clinical-scribe"
      ManagedBy = "terraform"
    }
  }
}
