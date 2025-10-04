#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# 1. Prompt for all required values
# --------------------------------------------------

# Generate unique project name with timestamp
PROJECT_NAME="Agentic-Job-Search-$(date +%Y%m%d%H%M%S)"

# 1) Prompt for GITHUB_URL if unset
if [ -z "${GITHUB_URL:-}" ]; then
  read -rp "Enter GitHub repository URL (e.g. https://github.com/OWNER/REPO or git@github.com:OWNER/REPO.git): " GITHUB_URL
fi

# 2) Normalize URL (strip .git and any trailing slash)
clean_url=${GITHUB_URL%.git}
clean_url=${clean_url%/}

# 3) Extract the path part (owner/repo) for HTTPS or SSH URLs
if [[ $clean_url =~ ^https://github\.com/([^/]+/[^/]+) ]]; then
  path="${BASH_REMATCH[1]}"
  # 4) Split into owner and repo
  GITHUB_OWNER=${path%%/*}
  GITHUB_REPO=${path##*/}
elif [[ $clean_url =~ ^git@github\.com:([^/]+/[^/]+) ]]; then
  path="${BASH_REMATCH[1]}"
  # 4) Split into owner and repo
  GITHUB_OWNER=${path%%/*}
  GITHUB_REPO=${path##*/}
else
  echo "Unable to parse owner/repo from '$GITHUB_URL'"
  read -rp "Enter GitHub owner manually: " GITHUB_OWNER
  read -rp "Enter GitHub repo  manually: " GITHUB_REPO
  echo "→ Using GITHUB_OWNER=$GITHUB_OWNER"
  echo "→ Using GITHUB_REPO=$GITHUB_REPO"
fi

# 5) Confirm detection
echo "Detected GitHub Owner: $GITHUB_OWNER"
echo "Detected GitHub Repo:  $GITHUB_REPO"
read -rp "Is this correct? (y/n): " CONFIRM
CONFIRM=$(printf '%s' "$CONFIRM" | tr '[:upper:]' '[:lower:]')

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "yes" && "$CONFIRM" != "" ]]; then
  read -rp "Enter GitHub owner manually: " GITHUB_OWNER
  read -rp "Enter GitHub repo  manually: " GITHUB_REPO
fi

# 6) Continue with your CDK flow
echo "→ Final GITHUB_OWNER=$GITHUB_OWNER"
echo "→ Final GITHUB_REPO=$GITHUB_REPO"

# Ensure GITHUB_URL is always a valid repository URL
GITHUB_URL="https://github.com/$GITHUB_OWNER/$GITHUB_REPO"

# 3) And for each CDK context var…
if [ -z "${GITHUB_TOKEN:-}" ]; then
  read -rp "Enter CDK context githubToken (Please check out the documentation for how to obtain githubToken): " GITHUB_TOKEN
fi

if [ -z "${SENDER_EMAIL:-}" ]; then
  read -rp "Enter e-mail address where emails will be sent from (context senderEmail): " SENDER_EMAIL
fi

if [ -z "${SENDER_NUMBER:-}" ]; then
  read -rp "Enter phone number for SMS notifications in format +19876543210 (context senderNumber): " SENDER_NUMBER
fi

if [ -z "${ACTION:-}" ]; then
  read -rp "Would you like to [deploy] or [destroy] the stacks? Type deploy or destroy: " ACTION
  ACTION=$(printf '%s' "$ACTION" | tr '[:upper:]' '[:lower:]')
fi

if [[ "$ACTION" != "deploy" && "$ACTION" != "destroy" ]]; then
  echo "Invalid choice: '$ACTION'. Please run again and choose deploy or destroy."
  exit 1
fi

# --------------------------------------------------
# 2. Ensure IAM service role exists
# --------------------------------------------------

ROLE_NAME="${PROJECT_NAME}-service-role"
echo "Checking for IAM role: $ROLE_NAME"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "✓ IAM role exists"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
  echo "✱ Creating IAM role: $ROLE_NAME"
  TRUST_DOC='{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"codebuild.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_DOC" \
    --query 'Role.Arn' --output text)

  echo "Creating and attaching custom CDK deployment policy..."

  # Create custom policy with minimum required permissions for CDK deployment
  CUSTOM_POLICY_NAME="${PROJECT_NAME}-cdk-policy"
  CUSTOM_POLICY_ARN=$(aws iam create-policy \
    --policy-name "$CUSTOM_POLICY_NAME" \
    --policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "cloudformation:*",
            "iam:*",
            "lambda:*",
            "dynamodb:*",
            "s3:*",
            "bedrock:*",
            "bedrock-agentcore:*",
            "sqs:*",
            "sns:*",
            "ses:*",
            "events:*",
            "ecr:*",
            "secretsmanager:*",
            "amplify:*",
            "codebuild:*",
            "logs:*",
            "apigateway:*",
            "ssm:*"
          ],
          "Resource": "*"
        },
        {
          "Effect": "Allow",
          "Action": [
            "sts:AssumeRole"
          ],
          "Resource": "arn:aws:iam::*:role/cdk-*"
        }
      ]
    }' \
    --query 'Policy.Arn' --output text)

  echo "Attaching custom policy: $CUSTOM_POLICY_ARN"
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "$CUSTOM_POLICY_ARN"

  # Wait for propagation
  echo "✓ IAM role created"
  echo "Waiting for IAM role to propagate for 10 seconds..."
  sleep 10
fi

# --------------------------------------------------
# 3. Create CodeBuild project
# --------------------------------------------------

echo "Creating CodeBuild project: $PROJECT_NAME"

# --------------------------------------------------
# Build environment with explicit environmentVariables
# --------------------------------------------------

ENVIRONMENT='{
  "type": "ARM_CONTAINER",
  "image": "aws/codebuild/amazonlinux-aarch64-standard:3.0",
  "computeType": "BUILD_GENERAL1_LARGE",
  "privilegedMode": true,
  "environmentVariables": [
    {
      "name":  "GITHUB_TOKEN",
      "value": "'"$GITHUB_TOKEN"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "GITHUB_OWNER",
      "value": "'"$GITHUB_OWNER"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "GITHUB_REPO",
      "value": "'"$GITHUB_REPO"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "SENDER_EMAIL",
      "value": "'"$SENDER_EMAIL"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "SENDER_NUMBER",
      "value": "'"$SENDER_NUMBER"'",
      "type":  "PLAINTEXT"
    },
    {
      "name":  "ACTION",
      "value": "'"$ACTION"'",
      "type":  "PLAINTEXT"
    }
  ]
}'

# No artifacts
ARTIFACTS='{"type":"NO_ARTIFACTS"}'

SOURCE='{"type":"GITHUB","location":"'"$GITHUB_URL"'"}'

# Which branch to build

echo "Creating CodeBuild project '$PROJECT_NAME' using GitHub repo '$GITHUB_URL' ..."
aws codebuild create-project \
  --name "$PROJECT_NAME" \
  --source "$SOURCE" \
  --artifacts "$ARTIFACTS" \
  --environment "$ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json \
  --no-cli-pager

if [ $? -eq 0 ]; then
  echo "✓ CodeBuild project '$PROJECT_NAME' created successfully."
else
  echo "✗ Failed to create CodeBuild project. Please verify AWS CLI permissions and parameters."
  exit 1
fi

# --------------------------------------------------
# 4. Start the build
# --------------------------------------------------

echo "Starting build for project '$PROJECT_NAME'..."
aws codebuild start-build \
  --project-name "$PROJECT_NAME" \
  --no-cli-pager \
  --output json

if [ $? -eq 0 ]; then
  echo "✓ Build started successfully."
else
  echo "✗ Failed to start the build."
  exit 1
fi

# --------------------------------------------------
# 5. List existing CodeBuild projects
# --------------------------------------------------

echo "Current CodeBuild projects:"
aws codebuild list-projects --output table

# --------------------------------------------------
# End of script
# --------------------------------------------------
exit 0