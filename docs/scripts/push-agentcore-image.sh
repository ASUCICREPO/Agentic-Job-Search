#!/usr/bin/env bash
set -euo pipefail

# Script to build and push AgentCore Docker image to ECR
# This builds only the JobSearchAgent image without full CDK deployment

# --------------------------------------------------
# 1. Configuration
# --------------------------------------------------

# Prompt for AWS profile if not set
if [ -z "${AWS_PROFILE:-}" ]; then
  read -rp "Enter AWS profile name (default: default): " AWS_PROFILE
  AWS_PROFILE=${AWS_PROFILE:-default}
fi

echo "Using AWS profile: $AWS_PROFILE"
export AWS_PROFILE

# Prompt for AWS region if not set
if [ -z "${AWS_REGION:-}" ]; then
  read -rp "Enter AWS region (default: us-west-2): " AWS_REGION
  AWS_REGION=${AWS_REGION:-us-west-2}
fi

# Prompt for ECR repository name
if [ -z "${ECR_REPO_NAME:-}" ]; then
  read -rp "Enter ECR repository name (default: job-search-agent): " ECR_REPO_NAME
  ECR_REPO_NAME=${ECR_REPO_NAME:-job-search-agent}
fi

# Prompt for image tag
if [ -z "${IMAGE_TAG:-}" ]; then
  read -rp "Enter image tag (default: latest): " IMAGE_TAG
  IMAGE_TAG=${IMAGE_TAG:-latest}
fi

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" == "arm64" ] || [ "$ARCH" == "aarch64" ]; then
  PLATFORM="linux/arm64"
  echo "Detected ARM64 architecture"
else
  PLATFORM="linux/amd64"
  echo "Detected AMD64 architecture"
fi

# --------------------------------------------------
# 2. Get AWS Account ID
# --------------------------------------------------

echo "Getting AWS account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
echo "AWS Account ID: $AWS_ACCOUNT_ID"

# --------------------------------------------------
# 3. Create ECR repository if it doesn't exist
# --------------------------------------------------

echo "Checking if ECR repository exists..."
if aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
  echo "✓ ECR repository '$ECR_REPO_NAME' exists"
else
  echo "Creating ECR repository '$ECR_REPO_NAME'..."
  aws ecr create-repository \
    --repository-name "$ECR_REPO_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --image-scanning-configuration scanOnPush=true \
    --output json
  echo "✓ ECR repository created"
fi

# --------------------------------------------------
# 4. Authenticate Docker to ECR
# --------------------------------------------------

echo "Authenticating Docker to ECR..."
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

if [ $? -eq 0 ]; then
  echo "✓ Docker authenticated to ECR"
else
  echo "✗ Failed to authenticate Docker to ECR"
  exit 1
fi

# --------------------------------------------------
# 5. Build Docker image
# --------------------------------------------------

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:$IMAGE_TAG"

echo "Building Docker image..."
echo "Platform: $PLATFORM"
echo "Image URI: $ECR_URI"

cd "$(dirname "$0")/../../backend/JobSearchAgent"

docker build --platform "$PLATFORM" -t "$ECR_URI" .

if [ $? -eq 0 ]; then
  echo "✓ Docker image built successfully"
else
  echo "✗ Failed to build Docker image"
  exit 1
fi

# --------------------------------------------------
# 6. Push to ECR
# --------------------------------------------------

echo "Pushing Docker image to ECR..."
docker push "$ECR_URI"

if [ $? -eq 0 ]; then
  echo "✓ Image pushed successfully to ECR"
  echo ""
  echo "============================================"
  echo "Image URI: $ECR_URI"
  echo "============================================"
  echo ""
  echo "You can now use this image URI in your Bedrock AgentCore configuration."
else
  echo "✗ Failed to push Docker image to ECR"
  exit 1
fi

# --------------------------------------------------
# 7. Display image information
# --------------------------------------------------

echo "Image details:"
aws ecr describe-images \
  --repository-name "$ECR_REPO_NAME" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --image-ids imageTag="$IMAGE_TAG" \
  --output table

exit 0
