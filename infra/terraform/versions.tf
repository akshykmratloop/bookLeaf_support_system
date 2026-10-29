# The BookLeaf demo box. Everything here is removed by `infra/scripts/destroy.sh` (terraform destroy).
# Run with AWS_PROFILE=loopmethods. State lives in the account's existing Terraform state bucket
# under its own key, so it never touches the QA stack's state.
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket       = "loopqa-tfstate-533063875346"
    key          = "bookleaf/demo/terraform.tfstate"
    region       = "ap-south-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      ManagedBy   = "terraform"
      Project     = var.project
      Environment = var.environment
      Repo        = var.github_repo
    }
  }
}
