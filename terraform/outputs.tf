output "ecr_repository_url" {
  description = "ECR repository URL for pushing images"
  value       = aws_ecr_repository.agent.repository_url
}

output "alb_dns_name" {
  description = "ALB DNS name (use for testing before DNS propagates)"
  value       = aws_lb.main.dns_name
}

output "service_url" {
  description = "Full service URL"
  value       = var.enable_https ? "https://${var.domain_name}" : "http://${var.domain_name}"
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for container logs"
  value       = aws_cloudwatch_log_group.agent.name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.agent.name
}

# Helper commands
output "push_commands" {
  description = "Commands to build and push Docker image"
  value       = <<-EOT

    # Authenticate Docker to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com

    # Build and push (from project root)
    docker build -t ${aws_ecr_repository.agent.repository_url}:latest .
    docker push ${aws_ecr_repository.agent.repository_url}:latest

    # Force new deployment
    aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.agent.name} --force-new-deployment

  EOT
}

output "openclaw_security_group_id" {
  description = "Security group ID for OpenClaw agent containers"
  value       = aws_security_group.openclaw_agents.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for OpenClaw agent containers"
  value       = aws_subnet.private[*].id
}

output "openclaw_task_definition_arn" {
  description = "Task definition ARN for OpenClaw containers"
  value       = aws_ecs_task_definition.openclaw.arn
}

output "set_secrets_commands" {
  description = "Commands to set secret values"
  value       = <<-EOT

    # Set secrets (replace values with actual secrets)
    aws secretsmanager put-secret-value --secret-id ${aws_secretsmanager_secret.anthropic_api_key.name} --secret-string "sk-ant-..."
    aws secretsmanager put-secret-value --secret-id ${aws_secretsmanager_secret.admin_secret.name} --secret-string "your-admin-secret"
    aws secretsmanager put-secret-value --secret-id ${aws_secretsmanager_secret.github_token.name} --secret-string "ghp_..."
    aws secretsmanager put-secret-value --secret-id ${aws_secretsmanager_secret.agent_wallet.name} --secret-string '[1,2,3,...]'

  EOT
}
