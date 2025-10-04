# Deployment Guide

## Common Prerequisites

- Fork this repository to your own GitHub account (required for deployment and Frontend CI/CD):
  1. Navigate to https://github.com/ASUCICREPO/Agentic-Job-Search.git
  2. Click the "Fork" button in the top right corner
  3. Select your GitHub account as the destination
  4. Wait for the forking process to complete
  5. You'll now have your own copy at https://github.com/YOUR-USERNAME/Agentic-Job-Search

- Sender's Email Address (required for sending automated emails):
  - Choose an email address you have access to - this will be used as the sender address for automated job recommendation emails
  - The application uses Amazon SES to send daily job recommendations to users
  - You must have access to this email inbox to complete the email verification process during deployment
  - Example: your-admin-email@yourdomain.com or your-personal-email@gmail.com

- Obtain a GitHub personal access token with repo permissions (needed for CDK deployment):
  1. Go to GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Give the token a name and select the "repo" and "admin:repo_hook" scope
  4. Click "Generate token" and save the token securely
  For detailed instructions, see:
  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

- AWS Account Permissions
   - Ensure permissions to create and manage AWS resources like S3, Lambda, Bedrock, DynamoDB, Amplify, SQS, SES, EventBridge, etc.
   - [AWS IAM Policies and Permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)

- SMS Messaging Setup (Optional)
   - For SMS notifications to work, you'll need to set up a 10DLC phone number
   - See [SMS Prerequisites Guide](docs/SMS_PREREQUISITES.md) for detailed setup instructions

## Deployment Instructions

### Deployment Using AWS CodeBuild and AWS Cloudshell

#### Prerequisites

- Have access to CodeBuild and AWS Cloudshell

#### Deployment

1. Open AWS CloudShell in your AWS Console:
   - Click the CloudShell icon in the AWS Console navigation bar
   - Wait for the CloudShell environment to initialize

2. Clone the repository (Make sure to have your own forked copy of the repo and replace the link with the forked repository link):
```bash
git clone https://github.com/<YOUR-USERNAME>/Agentic-Job-Search && cd Agentic-Job-Search/
```

3. Deploy using the deployment script (recommended):
The script would prompt you for variables needed for deployment.
```bash
./deploy.sh
```

4. **Post-Deployment Setup**: After CodeBuild deployment completes, follow the [Post-Deployment Setup Guide](POST_DEPLOYMENT_SETUP.md) to configure Knowledge Bases, AgentCore Memory, and update environment variables.

### Manual CDK Deployment

#### Prerequisites

1. **AWS CLI**: To interact with AWS services and set up credentials.

   - [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)

2. **npm**
   - npm is required to install AWS CDK. Install npm by installing Node.js:
     - [Download Node.js](https://nodejs.org/) (includes npm).
   - Verify npm installation:
     ```bash
     npm --version
     ```
3. **AWS CDK**: For defining cloud infrastructure in code.
   - [Install AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
     ```bash
     npm install -g aws-cdk
     ```

4. **Docker**: Required to build and run Docker images for the ECS tasks.
   - [Install Docker](https://docs.docker.com/get-docker/)
   - Verify installation:
     ```bash
     docker --version
     ```

#### Deployment

1. Clone the repository (Make sure to fork the repository first):
```bash
git clone https://github.com/<YOUR-USERNAME>/Agentic-Job-Search
cd Agentic-Job-Search/
```

2. **Set Up Your Environment**:
Configure AWS CLI with your AWS account credentials:
  ```bash
  aws configure
  ```

3. Install dependencies:
```bash
cd backend
npm install
```

4. Bootstrap CDK:
```bash
cdk bootstrap --all \
  -c senderEmail=YOUR_ADMIN_EMAIL \
  -c githubToken=YOUR_GITHUB_TOKEN \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c githubRepo=Agentic-Job-Search \
  -c senderNumber=YOUR_SENDER_PHONE_NUMBER
```

5. Deploy the stack:
```bash
cdk deploy --all \
  -c senderEmail=YOUR_ADMIN_EMAIL \
  -c githubToken=YOUR_GITHUB_TOKEN \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c githubRepo=Agentic-Job-Search \
  -c senderNumber=YOUR_SENDER_PHONE_NUMBER
```

6. **Post-Deployment Setup**: After manual deployment completes, follow the [Post-Deployment Setup Guide](POST_DEPLOYMENT_SETUP.md) to configure Knowledge Bases, AgentCore Memory, and update environment variables.
