terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "oclushion-terraform-state"
    key            = "oclushion/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "oclushion-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}
