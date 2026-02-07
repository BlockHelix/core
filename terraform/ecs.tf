# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled" # Skip for hackathon cost savings
  }
}

# CloudWatch log group for container logs
resource "aws_cloudwatch_log_group" "agent" {
  name              = "/ecs/${local.name_prefix}-agent"
  retention_in_days = 7
}

# IAM role for ECS task execution (pulling images, writing logs)
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-secrets-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.github_token.arn,
          aws_secretsmanager_secret.agent_wallet.arn,
          aws_secretsmanager_secret.encryption_key.arn,
        ]
      }
    ]
  })
}

# IAM role for ECS task (application permissions)
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# S3 bucket for agent config storage
resource "aws_s3_bucket" "agent_storage" {
  bucket = "${local.name_prefix}-storage"
}

resource "aws_s3_bucket_versioning" "agent_storage" {
  bucket = aws_s3_bucket.agent_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "agent_storage" {
  bucket = aws_s3_bucket.agent_storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Encryption key for API keys at rest
resource "aws_secretsmanager_secret" "encryption_key" {
  name = "${local.name_prefix}/encryption-key"
}

# Allow ECS task to access S3 bucket
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-s3-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.agent_storage.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.agent_storage.arn
      }
    ]
  })
}

# ECS Task Definition
resource "aws_ecs_task_definition" "agent" {
  family                   = "${local.name_prefix}-agent"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "agent"
      image = "${aws_ecr_repository.agent.repository_url}:latest"

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "PORT", value = tostring(var.container_port) },
        { name = "NODE_ENV", value = var.environment == "prod" ? "production" : "development" },
        { name = "ANCHOR_PROVIDER_URL", value = "https://api.devnet.solana.com" },
        { name = "SOLANA_NETWORK", value = "devnet" },
        { name = "VAULT_PROGRAM_ID", value = "HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS" },
        { name = "REGISTRY_PROGRAM_ID", value = "jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9" },
        { name = "FACTORY_PROGRAM_ID", value = "7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j" },
        { name = "USDC_MINT", value = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" },
        { name = "X402_FACILITATOR_URL", value = "https://x402.org/facilitator" },
        { name = "ECS_CLUSTER_NAME", value = aws_ecs_cluster.main.name },
        { name = "OPENCLAW_TASK_DEFINITION", value = aws_ecs_task_definition.openclaw.arn },
        { name = "OPENCLAW_SECURITY_GROUP", value = aws_security_group.openclaw_agents.id },
        { name = "OPENCLAW_SUBNETS", value = join(",", aws_subnet.private[*].id) },
        { name = "USE_S3_STORAGE", value = "true" },
        { name = "STORAGE_BUCKET", value = aws_s3_bucket.agent_storage.id },
        { name = "AWS_REGION", value = data.aws_region.current.name },
      ]

      secrets = [
        {
          name      = "GITHUB_TOKEN"
          valueFrom = aws_secretsmanager_secret.github_token.arn
        },
        {
          name      = "AGENT_WALLET_PRIVATE_KEY"
          valueFrom = aws_secretsmanager_secret.agent_wallet.arn
        },
        {
          name      = "ENCRYPTION_KEY"
          valueFrom = aws_secretsmanager_secret.encryption_key.arn
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.agent.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# ECS Service
resource "aws_ecs_service" "agent" {
  name            = "${local.name_prefix}-agent"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.agent.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.agent.arn
    container_name   = "agent"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]
}
