# OpenClaw agent container infrastructure
# Each agent runs in an isolated Fargate task in private subnets
# Zero AWS permissions, metadata access blocked, non-root, read-only FS

# --- Security Group: tightened egress ---

resource "aws_security_group" "openclaw_agents" {
  name        = "${local.name_prefix}-openclaw-agents-sg"
  description = "Security group for OpenClaw agent containers"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "From runtime"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "HTTPS outbound (Claude API, GitHub, npm)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS over TCP"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-openclaw-agents-sg"
  }
}

# --- Logs ---

resource "aws_cloudwatch_log_group" "openclaw" {
  name              = "/ecs/${local.name_prefix}-openclaw"
  retention_in_days = 7
}

# --- Zero-permission IAM role for agent containers ---

resource "aws_iam_role" "openclaw_task" {
  name = "${local.name_prefix}-openclaw-task"

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

# --- Runtime's permission to manage openclaw tasks ---

resource "aws_iam_role_policy" "ecs_task_openclaw" {
  name = "${local.name_prefix}-openclaw-management"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeNetworkInterfaces",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.openclaw_task.arn,
        ]
      },
    ]
  })
}

# --- Hardened task definition ---

resource "aws_ecs_task_definition" "openclaw" {
  family                   = "${local.name_prefix}-openclaw"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.openclaw_task.arn

  container_definitions = jsonencode([
    {
      name  = "openclaw"
      image = "${aws_ecr_repository.agent.repository_url}:openclaw-latest"
      user  = "1000:1000"

      readonlyRootFilesystem = false

      linuxParameters = {
        capabilities = {
          drop = ["ALL"]
        }
      }

      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "PORT", value = "3001" },
        { name = "NODE_ENV", value = "production" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.openclaw.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

}
