# ASU Agentic Job Search - System Architecture & User Flow

## Overview

This documentation describes the AI-powered career services system architecture, featuring a multi-agent system with intelligent job matching and personalized career guidance through a conversational interface.

## Application Routes & User Journey

### Route Structure
The React application uses client-side routing with AWS Amplify handling SPA redirects:

- **`/` (ProfilePage)**: Initial profile setup and resume upload
- **`/job-options` (JobOptionsPage)**: Job search category selection  
- **`/chatbot` (ChatBotPage)**: AI-powered conversational interface

### User Experience Flow

#### 1. Profile Setup (`/`)
**Initial onboarding and profile creation**
- **Resume Upload**: Optional AI-powered resume parsing using AWS Bedrock
- **Profile Form**: Personal information, education, experience, job preferences
- **Notification Settings**: Opt-in for daily job alerts via email/SMS
- **Data Storage**: Profile saved to DynamoDB with email as primary key
- **Navigation**: Proceeds to job options after successful profile save

#### 2. Job Search Options (`/job-options`)
**Category selection for targeted job search**
- **Part-time Jobs**: Student-friendly flexible positions
- **Full-time & Internships**: Career-focused opportunities  
- **Career Exploration**: Guidance on career paths and majors
- **Context Passing**: User name and preferences carried to chat interface
- **Navigation**: All options lead to the chatbot with appropriate context

#### 3. AI Chat Interface (`/chatbot`)
**Conversational job search and career guidance**
- **Multi-Agent System**: Orchestrator routes queries to specialized agents
- **Job Search**: Natural language job discovery with personalized results
- **Career Advice**: Professional development guidance with source citations
- **Interactive Results**: Job popup modals with detailed fit analysis
- **Memory Integration**: Conversation history and user preferences
- **Profile Access**: Return to profile page for updates

## Multi-Agent AI Architecture

### Agent System Design
The system implements the "Agents as Tools" pattern with three specialized agents:

#### Orchestrator Agent
- **Intent Recognition**: Analyzes user queries to determine appropriate routing
- **Context Management**: Integrates conversation history and user preferences
- **Query Enhancement**: Enriches queries with profile data and session context
- **Response Coordination**: Manages interactions between specialized agents
- **Memory Integration**: Bedrock AgentCore for conversation continuity

#### Job Search Agent
- **Live Search Mode**: Interactive job discovery with immediate JSON results
- **Batch Processing Mode**: Automated daily job matching for notifications
- **Knowledge Base Integration**: Searches job listings using semantic similarity
- **Personalization**: Uses profile data, conversation history, and stated preferences
- **Fit Analysis**: Comprehensive matching based on skills, experience, and career goals
- **Performance Optimization**: Limited to 5 knowledge base queries per search

#### Career Advice Agent
- **Professional Guidance**: Career development tips and best practices
- **Resource Integration**: Searches career resources knowledge base
- **Source Citations**: Provides URLs and references for advice
- **Memory-Aware**: Builds on previous career advice sessions
- **Personalized Recommendations**: Tailored to user's career trajectory and goals

### Memory & Personalization System

#### Bedrock AgentCore Integration
- **Actor-Based Memory**: Email-based user identification for long-term memory
- **Session Continuity**: Session ID tracking for conversation context
- **Preference Storage**: User preferences and job search history
- **Conversation History**: Multi-turn context preservation across sessions

#### Profile Integration
- **Resume Analysis**: AI extraction of skills, experience, and education
- **Preference Tracking**: Job role preferences, location, notification settings
- **Context Enrichment**: Combines profile data with conversation context
- **Continuous Learning**: Improves recommendations based on user interactions

## Daily Job Processing System

### Automated Workflow Architecture

#### 1. EventBridge Scheduling
- **Daily Trigger**: 1 AM MST (8 AM UTC) for job processing
- **Notification Trigger**: 9 AM MST (4 PM UTC) for email/SMS delivery
- **Batch Processing**: Scans all users with notification opt-in enabled

#### 2. SQS Message Processing
- **Queue Distribution**: Individual job search tasks per user
- **Message Format**: User profile data, email, session ID, and processing type
- **Parallel Processing**: Multiple Lambda instances handle concurrent requests
- **Error Handling**: Failed messages don't affect other user processing

#### 3. AgentCore Batch Processing
- **Enhanced Prompts**: Comprehensive user profile data for personalized matching
- **Batch Mode**: Specialized agent behavior for automated processing
- **Database Storage**: Job recommendations saved to DynamoDB
- **Performance Optimization**: Efficient knowledge base usage for scalability

#### 4. Notification Delivery
- **Email Integration**: Amazon SES for personalized job alert emails
- **SMS Integration**: Amazon SNS for optional text message notifications
- **Preference Respect**: Only sends to users with active opt-in status
- **Content Personalization**: Tailored job summaries based on user preferences

## Data Architecture & Storage

### DynamoDB Tables

#### Student Profile Table
- **Partition Key**: `actionID` (email-based identifier)
- **Data**: Personal info, education, experience, preferences, notification settings
- **Usage**: Profile management, agent personalization, batch processing

#### Job Recommendations Table  
- **Partition Key**: `userJobKey` (email#job_type composite)
- **Sort Key**: `createdAt` (timestamp for chronological ordering)
- **Data**: Job details, fit analysis, recommendation metadata
- **Usage**: Daily job storage, notification content, user job history

### S3 Storage

#### Resume Bucket
- **Purpose**: Uploaded resume document storage
- **Processing**: Lambda-based AI parsing using AWS Bedrock
- **Security**: Encrypted storage with CORS configuration
- **Integration**: Direct frontend upload with presigned URLs

#### Jobs Bucket
- **Purpose**: Job listing data source for knowledge base
- **Integration**: Bedrock knowledge base with S3 data source
- **Processing**: Daily updates with new job postings
- **Search**: Semantic similarity using Titan embeddings

### Knowledge Base Architecture

#### Job Search Knowledge Base
- **Embedding Model**: Amazon Titan Embed Text v2
- **Data Source**: S3 bucket with job listings
- **Context Enrichment**: Anthropic Claude Haiku for enhanced context
- **Search Optimization**: Semantic similarity matching for relevant results

#### Career Resources Knowledge Base
- **Purpose**: Professional development resources and guidance
- **Integration**: Career advice agent tool integration
- **Content**: Industry best practices, career development resources
- **Source Citations**: URL extraction and reference provision

## AWS Infrastructure Components

### Lambda Functions

#### Frontend Integration
- **Save Profile**: Direct function URL for profile data persistence
- **Resume Parser**: AI-powered resume analysis and profile extraction
- **CORS Configuration**: Secure frontend access with appropriate headers

#### Backend Processing
- **Batch Processor**: Daily user scanning and SQS message generation
- **SQS Processor**: Individual job search processing using AgentCore
- **Notification Sender**: Email/SMS delivery with personalization

#### Agent System
- **Job Search Agent**: Containerized multi-agent system deployment
- **Docker Integration**: ECR-based container deployment for complex dependencies
- **Environment Configuration**: Knowledge base IDs, table names, service ARNs

### AWS Amplify Deployment

#### Frontend Hosting
- **GitHub Integration**: Automatic deployment from repository changes with secure token management
- **Security**: GitHub Personal Access Token stored in AWS Secrets Manager with proper IAM permissions
- **Build Configuration**: React build process with frontend-specific settings
- **Custom Rules**: SPA routing support for React Router DOM
  - Regex catch-all pattern for routes without file extensions → `/index.html`
  - Explicit `/job-options` → `/index.html` (rewrite for SPA routing)
  - Explicit `/chatbot` → `/index.html` (rewrite for SPA routing)
- **Environment Variables**: AWS service endpoints and configuration

#### CI/CD Pipeline
- **Automatic Builds**: Triggered by GitHub repository changes and CDK deployments
- **Custom Resource Integration**: AWS Custom Resource triggers builds on stack creation/updates
- **Secure Authentication**: Amplify app granted read access to GitHub token secret
- **Build Optimization**: Node.js dependency caching for faster builds
- **Production Deployment**: Optimized React build with asset optimization
- **Route Configuration**: Proper SPA routing support for all application routes

## Security & Best Practices

### Data Protection
- **Encryption**: All S3 buckets and DynamoDB tables encrypted at rest
- **HTTPS Only**: All communication secured with TLS
- **Access Control**: IAM roles with least privilege principles
- **Secret Management**: GitHub tokens stored securely in AWS Secrets Manager
- **Secure CI/CD**: Amplify app granted proper read permissions to access GitHub credentials
- **CORS Configuration**: Secure frontend-backend communication

### Performance Optimization
- **Knowledge Base Limits**: Maximum 5 queries per job search for efficiency
- **Streaming Responses**: Real-time user interaction with progressive loading
- **Batch Processing**: Scalable daily job matching without user impact
- **Memory Management**: Efficient conversation context handling

### Monitoring & Observability
- **CloudWatch Logs**: Comprehensive logging across all Lambda functions
- **Error Tracking**: Detailed error handling and alerting
- **Performance Metrics**: SQS processing times and success rates
- **User Analytics**: Job search patterns and recommendation effectiveness

## Files
- `user_flow.dot` - Graphviz source file
- `user_flow.png` - Generated flow diagram image

## Generate Image
```bash
dot -Tpng user_flow.dot -o user_flow.png
```