#!/bin/bash
set -e

# BlockHelix ECS Deployment Script
# Usage: ./scripts/deploy-ecs.sh [init|plan|apply|push|deploy]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TF_DIR="$PROJECT_ROOT/terraform"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

check_tfvars() {
    if [ ! -f "$TF_DIR/terraform.tfvars" ]; then
        error "terraform.tfvars not found. Copy terraform.tfvars.example and fill in values."
    fi
}

cmd_init() {
    log "Initializing Terraform..."
    cd "$TF_DIR"
    terraform init
}

cmd_plan() {
    check_tfvars
    log "Planning infrastructure changes..."
    cd "$TF_DIR"
    terraform plan
}

cmd_apply() {
    check_tfvars
    log "Applying infrastructure changes..."
    cd "$TF_DIR"
    terraform apply
}

cmd_push() {
    log "Building and pushing Docker image..."
    cd "$TF_DIR"

    # Get values from terraform output
    ECR_URL=$(terraform output -raw ecr_repository_url 2>/dev/null) || error "Run 'terraform apply' first"
    AWS_REGION=$(terraform output -raw 2>/dev/null | grep -oP 'region \K[a-z0-9-]+' || echo "us-east-1")
    AWS_ACCOUNT=$(echo "$ECR_URL" | cut -d. -f1)

    log "ECR URL: $ECR_URL"

    # Authenticate Docker
    log "Authenticating with ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_URL"

    # Build image
    log "Building Docker image..."
    cd "$PROJECT_ROOT"
    docker build -t "$ECR_URL:latest" .

    # Push image
    log "Pushing to ECR..."
    docker push "$ECR_URL:latest"

    log "Image pushed successfully!"
}

cmd_deploy() {
    log "Forcing new ECS deployment..."
    cd "$TF_DIR"

    CLUSTER=$(terraform output -raw ecs_cluster_name 2>/dev/null) || error "Run 'terraform apply' first"
    SERVICE=$(terraform output -raw ecs_service_name 2>/dev/null)

    aws ecs update-service \
        --cluster "$CLUSTER" \
        --service "$SERVICE" \
        --force-new-deployment \
        --no-cli-pager

    log "Deployment triggered. Watch progress with:"
    echo "  aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE"
}

cmd_logs() {
    log "Tailing CloudWatch logs..."
    cd "$TF_DIR"

    LOG_GROUP=$(terraform output -raw cloudwatch_log_group 2>/dev/null) || error "Run 'terraform apply' first"

    aws logs tail "$LOG_GROUP" --follow
}

cmd_help() {
    cat << EOF
BlockHelix ECS Deployment

Usage: $0 <command>

Commands:
  init    - Initialize Terraform
  plan    - Show planned infrastructure changes
  apply   - Apply infrastructure changes
  push    - Build and push Docker image to ECR
  deploy  - Force new ECS deployment (after push)
  logs    - Tail CloudWatch logs

Typical workflow:
  1. Copy terraform/terraform.tfvars.example to terraform/terraform.tfvars
  2. Fill in your domain and AWS settings
  3. Run: $0 init
  4. Run: $0 apply
  5. Set secrets (see terraform output for commands)
  6. Run: $0 push
  7. Run: $0 deploy
EOF
}

case "${1:-help}" in
    init)   cmd_init ;;
    plan)   cmd_plan ;;
    apply)  cmd_apply ;;
    push)   cmd_push ;;
    deploy) cmd_deploy ;;
    logs)   cmd_logs ;;
    help)   cmd_help ;;
    *)      error "Unknown command: $1. Run '$0 help' for usage." ;;
esac
