# AI-Powered Job Search Assistant

A comprehensive chatbot application that provides intelligent job search and career guidance for students, powered by AWS Bedrock

This application combines natural language processing capabilities with a knowledge base of job listings and career resources to deliver accurate, context-aware responses to student queries. The system includes a user-friendly chat interface and automated daily job recommendations.

The application features a serverless architecture built on AWS services, with real-time communication, secure file management, and automated processing. Key features include:
- AI-powered responses using AWS Bedrock with Nova Pro and Claude 3.7 Sonnet
- Automated daily job recommendations via email
- Resume AI parsing for personalized job matching
- Real-time chat with streaming responses
- Automated batch processing for scalable job matching

## Architecture

### Architecture Diagram
<img width="746" height="741" alt="Screenshot 2025-10-01 at 1 46 56 PM" src="https://github.com/user-attachments/assets/272786b2-9161-4462-a97d-41e15608c61d" />


### Architecture Description
The ASU Job Search Assistant implements a **serverless, event-driven architecture** with a sophisticated **multi-agent AI system** at its core. The application follows modern cloud-native patterns with automated scaling, real-time processing, and intelligent job matching capabilities.

#### Core Architecture Principles

**Multi-Agent AI System**: Uses the "Agents as Tools" pattern with three specialized agents:

- **Orchestrator Agent**: Routes queries based on intent recognition and manages conversation flow
- **Job Search Agent**: Handles personalized job discovery with semantic search and fit analysis
- **Career Advice Agent**: Provides professional development guidance with source citations

**Event-Driven Processing**: Combines real-time user interactions with automated batch processing:

- **Real-time**: Interactive chat with streaming AI responses
- **Batch**: Daily automated job matching and notification delivery

**Memory & Personalization**: Multi-layered context management:

- **Long-term Memory**: AWS Bedrock AgentCore for cross-session continuity
- **Session Memory**: Conversation history within current session
- **Profile Integration**: Resume parsing and preference storage

#### Component Interactions & Data Flow

**1. User Interaction Layer**

```
Frontend (React/Amplify) → API Gateway → Lambda Functions
├── Profile Setup: Resume upload → S3 → AI parsing → DynamoDB
├── Job Search: Chat queries → Orchestrator Agent → Specialized Agents
└── Real-time Chat: WebSocket-style streaming responses
```

**2. AI Processing Pipeline**

```
User Query → Orchestrator Agent (Intent Recognition)
├── Job Search Intent → Job Search Agent
│   ├── Knowledge Base Query (Semantic Search)
│   ├── Profile Integration (Skills/Experience)
│   ├── Fit Analysis (AI-powered matching)
│   └── JSON Response (Structured job data)
└── Career Advice Intent → Career Advice Agent
    ├── Resource Knowledge Base Query
    ├── Memory Integration (Previous sessions)
    └── Actionable Guidance (With citations)
```

**3. Daily Automation Workflow**

```
EventBridge (1 AM MST) → Batch Processor Lambda
├── Scan DynamoDB (Users with notifications enabled)
├── Generate SQS Messages (Individual job searches)
├── SQS Processor → AgentCore (Personalized searches)
├── Save Results → DynamoDB (Job recommendations)
└── EventBridge (9 AM MST) → Notification Sender
    ├── Retrieve Recommendations → DynamoDB
    ├── Generate Personalized Emails → SES
    └── Optional SMS Notifications → SNS
```

**4. Knowledge Management System**

```
Data Sources (S3 Buckets)
├── Job Listings Bucket → Bedrock Knowledge Base (Jobs)
│   ├── Titan Embeddings (Semantic indexing)
│   └── Claude Haiku (Context enhancement)
└── Career Resources Bucket → Bedrock Knowledge Base (Resources)
    ├── Professional development content
    └── Industry best practices
```

#### Data Architecture & Storage Strategy

**DynamoDB Tables**:

- **Student Profiles**: User data, preferences, notification settings (Partition: email)
- **Job Recommendations**: Daily job matches with fit analysis (Partition: email#job_type, Sort: timestamp)

**S3 Storage Strategy**:

- **Resume Bucket**: Encrypted document storage with AI parsing pipeline
- **Jobs Bucket**: Structured job listings for knowledge base ingestion
- **Career Resources**: Professional development content and guidance materials

**Memory Architecture**:

- **AgentCore Memory**: Actor-based long-term memory with email identification
- **Session Continuity**: Conversation history with 5-turn context window
- **Preference Storage**: User job search patterns and feedback integration

#### AI Model Integration

**AWS Bedrock Models**:

- **Claude 4.5 Sonnet**: Primary orchestrator and specialized agent reasoning
- **Amazon Nova Pro**: Resume parsing and skill extraction
- **Titan Embeddings**: Semantic search for job matching
- **Claude Haiku**: Knowledge base context enhancement

**Agent Specialization**:

- **Performance Optimization**: Maximum 5 knowledge base queries per search
- **Context Enrichment**: Profile data + conversation history + stated preferences
- **Fit Analysis**: Comprehensive matching based on skills, experience, and career goals
- **Source Attribution**: URL extraction and citation for career advice

#### Security & Compliance

**Data Protection**:

- **Encryption**: All data encrypted at rest (S3, DynamoDB) and in transit (HTTPS/TLS)
- **Access Control**: IAM roles with least privilege principles
- **Secret Management**: GitHub tokens stored in AWS Secrets Manager

**Performance & Scalability**:

- **Serverless Architecture**: Auto-scaling Lambda functions and managed services
- **Queue-based Processing**: SQS for decoupled batch job processing
- **Streaming Responses**: Real-time user interaction with progressive loading
- **Knowledge Base Optimization**: Efficient semantic search with result caching

#### Monitoring & Observability

**Comprehensive Logging**:

- **CloudWatch Logs**: All Lambda function execution logs
- **Error Tracking**: Detailed error handling and alerting
- **Performance Metrics**: SQS processing times and success rates
- **User Analytics**: Job search patterns and recommendation effectiveness

This architecture ensures **high availability**, **scalability**, and **intelligent personalization** while maintaining **security best practices** and **cost optimization** through serverless technologies.

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

4. **Post-Deployment Setup**: After CodeBuild deployment completes, follow the [Post-Deployment Setup Guide](docs/POST_DEPLOYMENT_SETUP.md) to configure Knowledge Bases, AgentCore Memory, and update environment variables.

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

6. **Post-Deployment Setup**: After manual deployment completes, follow the [Post-Deployment Setup Guide](docs/POST_DEPLOYMENT_SETUP.md) to configure Knowledge Bases, AgentCore Memory, and update environment variables.

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

5. Using the Application:
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


- **Resume Processing Pipeline**
  - **2.1** Resume parser Lambda uses Nova Pro to extract skills and experience
  - **2.2** Parsed data stored in DynamoDB for personalized job matching

- **Real-time Job Search**
  - **3.1** Job search queries processed by Strands Agents via AWS Bedrock
  - **3.2** Multi-agent system routes between Job Search and Career Advice agents
  - **3.3** Job Search agent queries knowledge base with job listings from JobsBucket
  - **3.4** Career Advice agent queries knowledge base with career resources from CareerResourcesBucket
  - **3.5** Responses include job listings, career guidance, and source citations

- **Automated Daily Job Processing**
  - **4.1** EventBridge triggers batch processor Lambda at 1 AM MST
  - **4.2** Scans all users with notification opt-in from DynamoDB
  - **4.3** Generates SQS messages for individual personalized job searches
  - **4.4** SQS processor invokes Bedrock AgentCore for each user
  - **4.5** Job recommendations stored in DynamoDB

- **Daily Notification Delivery**
  - **5.1** EventBridge triggers notification sender Lambda at 9 AM MST
  - **5.2** Retrieves personalized job recommendations from DynamoDB
  - **5.3** Sends customized emails via Amazon SES
  - **5.4** Optional SMS notifications via Amazon SNS

- **Data Storage & Management**
  - **6.1** DynamoDB stores user profiles, preferences, and job recommendations
  - **6.2** S3 buckets handle resume storage, job listings, and career resources
  - **6.3** CloudWatch provides comprehensive logging and monitoring

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
