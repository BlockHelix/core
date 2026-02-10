# EFS for OpenClaw agent persistent workspaces
# Each agent gets an EFS access point (created dynamically by container-manager)
# that locks it to /agents/{agentId}/ — no cross-agent access

resource "aws_efs_file_system" "agent_workspaces" {
  creation_token = "${local.name_prefix}-agent-workspaces"
  encrypted      = true

  tags = {
    Name = "${local.name_prefix}-agent-workspaces"
  }
}

resource "aws_efs_mount_target" "agent_workspaces" {
  count           = length(aws_subnet.private)
  file_system_id  = aws_efs_file_system.agent_workspaces.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.agent_efs.id]
}

resource "aws_security_group" "agent_efs" {
  name        = "${local.name_prefix}-agent-efs"
  description = "Allow OpenClaw containers to access agent workspace EFS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "NFS from OpenClaw containers"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.openclaw_agents.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-agent-efs"
  }
}

# OpenClaw containers need NFS egress to reach EFS
resource "aws_security_group_rule" "openclaw_efs_egress" {
  type                     = "egress"
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.agent_efs.id
  security_group_id        = aws_security_group.openclaw_agents.id
  description              = "NFS to agent workspace EFS"
}

# OpenClaw task role needs EFS permissions
resource "aws_iam_role_policy" "openclaw_efs" {
  name = "${local.name_prefix}-openclaw-efs"
  role = aws_iam_role.openclaw_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:ClientMount",
          "elasticfilesystem:ClientWrite",
          "elasticfilesystem:ClientRootAccess",
        ]
        Resource = aws_efs_file_system.agent_workspaces.arn
      }
    ]
  })
}

# Runtime needs to create/delete access points dynamically
resource "aws_iam_role_policy" "runtime_efs_management" {
  name = "${local.name_prefix}-runtime-efs-mgmt"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticfilesystem:CreateAccessPoint",
          "elasticfilesystem:DeleteAccessPoint",
          "elasticfilesystem:DescribeAccessPoints",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
        ]
        Resource = "*"
      }
    ]
  })
}

# SSM parameters so the runtime knows the EFS ID and related config
resource "aws_ssm_parameter" "agent_efs_id" {
  name  = "/${local.name_prefix}/agent-efs-id"
  type  = "String"
  value = aws_efs_file_system.agent_workspaces.id
}
