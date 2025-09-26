# AI-Powered ASU Job Search Assistant

A comprehensive chatbot application that provides intelligent job search and career guidance for ASU students, powered by AWS Bedrock

This application combines natural language processing capabilities with a knowledge base of job listings and career resources to deliver accurate, context-aware responses to student queries. The system includes a user-friendly chat interface and automated daily job recommendations.

The application features a serverless architecture built on AWS services, with real-time communication, secure file management, and automated processing. Key features include:
- AI-powered responses using AWS Bedrock with Nova Pro and Claude 3.7 Sonnet
- Automated daily job recommendations via email
- Resume AI parsing for personalized job matching
- Real-time chat with streaming responses
- Automated batch processing for scalable job matching

## Architecture

### Architecture Diagram
*[Architecture diagram will be added here]*

### Architecture Description
*[Detailed architecture description will be added here, including component interactions and data flow]*

### Demo Video
*[Demo video link will be added here]*

## Repository Structure
```
.
├── buildspec.yml              # AWS CodeBuild configuration Deployment
├── backend/                   # AWS CDK infrastructure code
│   ├── bin/                   # CDK app entry point
│   ├── lambda/                # Lambda functions for various services
│   │   ├── batch-processor/   # Daily job processing logic
│   │   ├── notification-sender/ # Email notification service
│   │   ├── resume-parser/     # Resume AI parsing handler
│   │   ├── save-profile/       # Profile management handler
│   │   └── sqs-processor/     # SQS job processing handler
│   └── lib/                   # CDK stack definitions
├── deploy.sh                  # Deployment automation script
└── frontend/                  # React-based web application
    ├── public/                # Static assets
    └── src/
        ├── components/        # React components for UI
        ├── pages/             # Application pages
        │   ├── ChatBotPage.tsx    # AI chat interface
        │   ├── JobOptionsPage.tsx # Job search options
        │   └── ProfilePage.tsx    # User profile management
        ├── services/          # API service functions
        └── utils/             # Utility functions
```

# Deployment Instructions
## Common Prerequisites

- Fork this repository to your own GitHub account (required for deployment and Frontend CI/CD):
  1. Navigate to https://github.com/ASUCICREPO/Agentic-Job-Search.git
  2. Click the "Fork" button in the top right corner
  3. Select your GitHub account as the destination
  4. Wait for the forking process to complete
  5. You'll now have your own copy at https://github.com/YOUR-USERNAME/Agentic-Job-Search

- Obtain a GitHub personal access token with repo permissions (needed for CDK deployment):
  1. Go to GitHub Settings > Developer Settings > Personal Access Tokens > Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Give the token a name and select the "repo" and "admin:repo_hook" scope
  4. Click "Generate token" and save the token securely
  For detailed instructions, see:
  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

- AWS Account Permissions
   - Ensure permissions to create and manage AWS resources like S3, Lambda, Bedrock, DynamoDB, Amplify, SQS, SNS, SES, EventBridge, etc.
   - [AWS IAM Policies and Permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html)


## Deployment Using AWS CodeBuild and AWS Cloudshell
### Prerequisites

- Have access to CodeBuild and AWS Cloudshell

### Deployment

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

## Manual CDK Deployment
### Prerequisites

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

### Deployment

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
  -c githubToken=YOUR_GITHUB_TOKEN \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c senderEmail=YOUR_ADMIN_EMAIL \
  -c githubRepo=Agentic-Job-Search
```

5. Deploy the stack:
```bash
cdk deploy --all \
  -c githubToken=YOUR_GITHUB_TOKEN \
  -c githubOwner=YOUR_GITHUB_USERNAME \
  -c senderEmail=YOUR_ADMIN_EMAIL \
  -c githubRepo=Agentic-Job-Search
```

## Usage

Once the infrastructure is deployed using either of the two approaches:

1. Upload job listings and career resources to the S3 buckets:
   - Upload job listings (PDF/JSON files) to the JobsBucket
   - Upload career resources (PDF files) to the CareerResourcesBucket

2. Sync the Knowledge Bases:
   - Go to AWS Console > Bedrock > Knowledge bases
   - Select the Job Search knowledge base
   - Click the "Sync data sources" button and wait for completion
   - Select the Career Resources knowledge base
   - Click the "Sync data sources" button and wait for completion

3. SES Email Verification (Post-Deployment)
   - An email will be sent from AWS to the provided admin email address for verification.
   - If you can't find the email, check the Spam folder and verify by clicking the given link.

4. Access the Frontend:
   - Go to AWS Console > AWS Amplify
   - Select the app created by the stack
   - Access the application URL provided by Amplify

3. Using the Application:
   - Navigate to the Amplify URL
   - Start by setting up your profile with optional resume upload
   - Choose your job search preferences (part-time, full-time, internships, etc.)
   - Use the chat interface to ask about jobs, internships, or career advice

Component interactions:
1. User submits query through chat interface
2. Lambda function processes request and invokes Strands Agents
3. Orchestrator routes to Job Search or Career Advice agents based on intent
4. Job Search agent queries knowledge base with job listings from JobsBucket
5. Career Advice agent queries knowledge base with resources from CareerResourcesBucket
6. AI responses include job listings, career guidance, and source citations
7. Job recommendations are stored in DynamoDB for notifications
8. Automated daily processing generates personalized job matches
9. Email notifications are sent via SES based on user preferences

## Infrastructure

The application features a serverless architecture with automated daily job processing:

- **User → Amplify Front-End**
  - **1.1** User sets up profile with optional resume upload
  - **1.2** User selects job search preferences (part-time, full-time, internships)
  - **1.3** User submits natural language job search queries
  - **1.4** Amplify displays AI responses with job recommendations

- **Amplify → Amazon API Gateway**
  - **2.1** API Gateway receives requests from Amplify front-end
  - **2.2** Routes requests to appropriate Lambda functions

- **Resume Processing Pipeline**
  - **3.1** Resume parser Lambda uses Claude 3.5 Sonnet to extract skills and experience
  - **3.2** Parsed data stored in DynamoDB for personalized job matching

- **Real-time Job Search**
  - **4.1** Job search queries processed by Strands Agents via AWS Bedrock
  - **4.2** Multi-agent system routes between Job Search and Career Advice agents
  - **4.3** Job Search agent queries knowledge base with job listings from JobsBucket
  - **4.4** Career Advice agent queries knowledge base with career resources from CareerResourcesBucket
  - **4.5** Responses include job listings, career guidance, and source citations

- **Automated Daily Job Processing**
  - **5.1** EventBridge triggers batch processor Lambda at 1 AM MST
  - **5.2** Scans all users with notification opt-in from DynamoDB
  - **5.3** Generates SQS messages for individual personalized job searches
  - **5.4** SQS processor invokes Bedrock AgentCore for each user
  - **5.5** Job recommendations stored in DynamoDB

- **Daily Notification Delivery**
  - **6.1** EventBridge triggers notification sender Lambda at 9 AM MST
  - **6.2** Retrieves personalized job recommendations from DynamoDB
  - **6.3** Sends customized emails via Amazon SES
  - **6.4** Optional SMS notifications via Amazon SNS

- **Data Storage & Management**
  - **7.1** DynamoDB stores user profiles, preferences, and job recommendations
  - **7.2** S3 buckets handle resume storage, job listings, and career resources
  - **7.3** CloudWatch provides comprehensive logging and monitoring

Lambda Functions:
- `batch-processor`: Orchestrates daily job processing workflow
- `notification-sender`: Handles email and SMS notifications
- `resume-parser`: AI-powered resume parsing with Claude 3.5 Sonnet
- `save-profile`: User profile creation and management
- `sqs-processor`: Individual user job search processing

AWS Services:
- Bedrock: AI models and knowledge bases for job search and career advice
- API Gateway: REST API endpoints for front-end communication
- DynamoDB: User data and job recommendations storage
- S3: Resume storage, job listings, and career resources
- SES: Email notifications for daily job recommendations
- SQS: Queue for batch job processing
- SNS: SMS notifications (optional)
- EventBridge: Scheduled daily processing automation
- Amplify: Front-end hosting and deployment

## 📄 License

See LICENSE file for details.