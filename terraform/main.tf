terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # TODO: Enable S3 backend for state management
  # backend "s3" {
  #   bucket = "blockhelix-terraform-state"
  #   key    = "ecs/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

locals {
  name_prefix = "blockhelix-${var.environment}"

  common_tags = {
    Project     = "BlockHelix"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
