# Secrets Manager secrets for sensitive configuration
# Values must be set manually after creation via AWS Console or CLI

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${local.name_prefix}/anthropic-api-key"
  description             = "Anthropic API key for Claude"
  recovery_window_in_days = 0 # Immediate deletion for hackathon
}

resource "aws_secretsmanager_secret" "admin_secret" {
  name                    = "${local.name_prefix}/admin-secret"
  description             = "Admin API secret for agent management"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret" "github_token" {
  name                    = "${local.name_prefix}/github-token"
  description             = "GitHub personal access token for PR creation"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret" "agent_wallet" {
  name                    = "${local.name_prefix}/agent-wallet"
  description             = "Solana wallet private key (base58 or JSON array)"
  recovery_window_in_days = 0
}

# Note: Set secret values after terraform apply:
#
# aws secretsmanager put-secret-value \
#   --secret-id blockhelix-dev/anthropic-api-key \
#   --secret-string "sk-ant-..."
#
# aws secretsmanager put-secret-value \
#   --secret-id blockhelix-dev/admin-secret \
#   --secret-string "your-admin-secret"
#
# aws secretsmanager put-secret-value \
#   --secret-id blockhelix-dev/github-token \
#   --secret-string "ghp_..."
#
# aws secretsmanager put-secret-value \
#   --secret-id blockhelix-dev/agent-wallet \
#   --secret-string "[1,2,3,...]"
