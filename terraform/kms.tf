# KMS key for Solana transaction signing (Ed25519)
# Created via AWS CLI since Terraform provider doesn't support ECC_NIST_EDWARDS25519 yet
# Key ID: 9f9cc7f4-4d84-4f16-b46d-433063b69f00
# Alias: alias/blockhelix-dev-job-signer

locals {
  kms_job_signer_id  = "9f9cc7f4-4d84-4f16-b46d-433063b69f00"
  kms_job_signer_arn = "arn:aws:kms:us-east-1:386166838496:key/9f9cc7f4-4d84-4f16-b46d-433063b69f00"
}

# IAM policy already added via CLI:
# aws iam put-role-policy --role-name blockhelix-dev-ecs-task --policy-name blockhelix-dev-kms-sign ...
