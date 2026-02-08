# ECR repository for the agent runtime container image
resource "aws_ecr_repository" "agent" {
  name                 = "${local.name_prefix}-agent"
  image_tag_mutability = "MUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Lifecycle policy to keep only recent images
resource "aws_ecr_lifecycle_policy" "agent" {
  repository = aws_ecr_repository.agent.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
