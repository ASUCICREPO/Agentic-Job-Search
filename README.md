# ASU Agentic Job Search Platform

An AI-powered job search and career services platform built for ASU students, featuring intelligent job matching with personalized career guidance through a conversational interface.

## 🚀 Features

- **Multi-Agent AI System**: Orchestrator routes queries between specialized Job Search and Career Advice agents
- **Intelligent Job Matching**: AWS Bedrock knowledge base with semantic search using Titan embeddings
- **Resume AI Parser**: Extracts skills and experience from uploaded resumes using Claude 3.5 Sonnet
- **Conversational Interface**: Natural language job search with memory-aware chat sessions
- **Automated Notifications**: Daily job recommendations via email/SMS using EventBridge scheduling
- **Profile Management**: Comprehensive student profiles with preferences and notification settings

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18+ with TypeScript and Styled Components
- **Routing**: React Router DOM with SPA support
- **State Management**: React Hooks (useState, useEffect)
- **Deployment**: AWS Amplify with GitHub CI/CD integration

### Backend (AWS Serverless)
- **Infrastructure**: AWS CDK (TypeScript) for Infrastructure as Code
- **Runtime**: AWS Lambda (Python 3.11/3.12) with containerized agents
- **AI Framework**: Strands Agents SDK with AWS Bedrock integration
- **Database**: DynamoDB for profiles and job recommendations
- **Storage**: S3 buckets for resumes and job data sources
- **Messaging**: SQS for job processing, SNS for notifications
- **Scheduling**: EventBridge for automated daily batch processing

### AI Components
- **Models**: Anthropic Claude 3.5 Sonnet via AWS Bedrock
- **Embeddings**: Amazon Titan Embed Text v2 for semantic search
- **Memory**: Bedrock AgentCore for conversation history and personalization
- **Knowledge Base**: AWS Bedrock with S3 data sources for job listings

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+ with pip
- AWS CLI configured with appropriate permissions
- Docker (for containerized Lambda functions)
- GitHub Personal Access Token for Amplify deployment

### Frontend Development
```bash
cd frontend
npm install
npm start  # Starts dev server on localhost:3000
```

### Backend Development
```bash
cd backend
npm install
npm run build
npx cdk deploy -c senderEmail=your@email.com -c githubToken=your_token -c githubOwner=your_username -c githubRepo=your_repo
```

### Python Agent Development
```bash
cd backend/JobSearchAgent
pip install -r requirements.txt
python StrandsAgents.py  # Test agents locally
```

## 📱 User Journey

### 1. Profile Setup (`/`)
- Optional resume upload with AI-powered parsing
- Personal information and job preferences form
- Notification settings for daily job alerts
- Profile data stored in DynamoDB

### 2. Job Search Options (`/job-options`)
- Part-time jobs for students
- Full-time positions and internships
- Career exploration and guidance
- Context passed to AI chat interface

### 3. AI Chat Interface (`/chatbot`)
- Natural language job search queries
- Real-time job recommendations with fit analysis
- Career advice with source citations
- Interactive job popup modals
- Memory-aware conversation continuity

## 🤖 Multi-Agent System

### Orchestrator Agent
- Intent recognition and query routing
- Context management with conversation history
- Query enhancement using profile data
- Response coordination between specialized agents

### Job Search Agent
- **Live Mode**: Interactive job discovery with JSON results
- **Batch Mode**: Automated daily job matching for notifications
- Semantic search through job listings knowledge base
- Personalized matching based on skills and preferences
- Performance optimized with query limits

### Career Advice Agent
- Professional development guidance
- Career resource knowledge base integration
- Source citations and URL references
- Memory-aware personalized recommendations

## 🔄 Automated Daily Processing

### 1 AM MST - Job Processing
- EventBridge triggers batch processor Lambda
- Scans all users with notification opt-in
- Generates SQS messages for individual processing
- AgentCore processes personalized job searches
- Results stored in DynamoDB job recommendations table

### 9 AM MST - Notification Delivery
- EventBridge triggers notification sender Lambda
- Retrieves stored job recommendations
- Sends personalized emails via Amazon SES
- Optional SMS notifications via Amazon SNS
- Respects user notification preferences

## 🗄️ Data Architecture

### DynamoDB Tables
- **StudentProfileTable**: User profiles, preferences, notification settings
- **JobRecommendationsTable**: Daily job matches with fit analysis

### S3 Buckets
- **ResumeBucket**: Uploaded resume storage with CORS configuration
- **JobsBucket**: Job listing data source for knowledge base

### Knowledge Bases
- **Job Search KB**: Semantic job matching with Titan embeddings
- **Career Resources KB**: Professional development guidance

## 🔐 Security & Performance

### Security Features
- All S3 buckets and DynamoDB tables encrypted at rest
- HTTPS-only communication with proper CORS configuration
- IAM roles with least privilege principles
- GitHub token stored securely in AWS Secrets Manager
- Amplify app granted read access to GitHub token secret

### Performance Optimizations
- Knowledge base query limits (max 5 per search)
- Streaming responses for real-time user interaction
- Efficient batch processing for scalable daily job matching
- Memory management for conversation context
- CDK-managed ECR for optimized container deployments

## 📊 Monitoring

- CloudWatch Logs for comprehensive Lambda function logging
- Error tracking and alerting across all services
- SQS processing metrics and success rates
- User analytics for job search patterns and effectiveness

## 🚀 Deployment

The application uses AWS Amplify for frontend deployment with automatic CI/CD:
- GitHub integration with secure token management via AWS Secrets Manager
- Automatic builds triggered by repository changes and CDK deployments
- Custom resource triggers initial build on stack creation/updates
- SPA routing support for React Router DOM with custom rewrite rules
- Production-optimized builds with asset optimization and dependency caching

## 📝 Environment Configuration

### Required CDK Context Variables
```bash
npx cdk deploy \
  -c senderEmail=your@email.com \
  -c githubToken=your_github_token \
  -c githubOwner=your_github_username \
  -c githubRepo=your_repository_name
```

### Frontend Environment Variables
- AWS service endpoints and configuration
- API Gateway URLs for Lambda functions

### Lambda Environment Variables
- DynamoDB table names and ARNs
- S3 bucket names
- SQS queue URLs and SNS topic ARNs
- Bedrock AgentCore runtime ARNs

## 🤝 Contributing

1. Follow TypeScript strict mode with explicit types
2. Use functional React components with hooks
3. Implement Python type hints and docstrings
4. Follow PascalCase for components, camelCase for utilities
5. External imports first, then relative imports

## 📄 License

See LICENSE file for details.