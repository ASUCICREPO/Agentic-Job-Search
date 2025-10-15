## Architecture

### Architecture Diagram
![Job Search Architecture Diagram](JOB%20SEARCH%20ARCHITECTURE%20DIAGRAM.png)


### Architecture Description
The Job Search Assistant implements a **serverless, event-driven architecture** with a sophisticated **multi-agent AI system** at its core. The application follows modern cloud-native patterns with automated scaling, real-time processing, and intelligent job matching capabilities.

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
Frontend (React/Amplify) → Lambda Function URLs
├── Profile Setup: Resume upload → S3 → AI parsing → DynamoDB
├── Job Search: Chat queries → Agent Proxy Lambda → Bedrock AgentCore
│   └── Agent Proxy bypasses Cognito session policies (allows unauthenticated access)
├── Orchestrator Agent → Specialized Agents (Intent Recognition)
└── Real-time Chat: Streaming responses via HTTP
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

#### Authentication & Authorization Architecture

**Unauthenticated Access Pattern**:

The application uses a **Lambda Proxy Pattern** to enable unauthenticated user access to Bedrock AgentCore while maintaining security:

```
Frontend → Agent Proxy Lambda (Function URL) → Bedrock AgentCore
└── Bypasses Cognito Identity session policy restrictions
```

**Why Lambda Proxy?**

- **Cognito Identity Limitation**: AWS Cognito Identity applies restrictive session policies for unauthenticated users that block `bedrock-agentcore:InvokeAgentRuntime` actions
- **Solution**: Lambda Function URL with proper IAM role permissions acts as a secure proxy
- **Benefit**: Enables seamless guest user experience without requiring sign-up

**Authentication Components**:

- **Cognito Identity Pool**: Used for S3 resume upload (unauthenticated role with S3 write permissions)
- **Agent Proxy Lambda**: IAM role with `bedrock-agentcore:InvokeAgentRuntime` permissions
- **Function URLs**: Direct HTTP access points for Lambda functions (profile, resume, agent proxy)

#### Security & Compliance

**Data Protection**:

- **Encryption**: All data encrypted at rest (S3, DynamoDB) and in transit (HTTPS/TLS)
- **Access Control**: IAM roles with least privilege principles
- **Secret Management**: GitHub tokens stored in AWS Secrets Manager
- **CORS Configuration**: Restricted to necessary origins and methods

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


