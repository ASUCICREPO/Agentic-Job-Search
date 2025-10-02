# Infrastructure Overview

The application features a serverless architecture with automated daily job processing:

## Application Flow

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

## Lambda Functions

- `batch-processor`: Orchestrates daily job processing workflow
- `notification-sender`: Handles email and SMS notifications
- `resume-parser`: AI-powered resume parsing with Claude 3.5 Sonnet
- `save-profile`: User profile creation and management
- `sqs-processor`: Individual user job search processing

## AWS Services

- **Bedrock**: AI models and knowledge bases for job search and career advice
- **API Gateway**: REST API endpoints for front-end communication
- **DynamoDB**: User data and job recommendations storage
- **S3**: Resume storage, job listings, and career resources
- **SES**: Email notifications for daily job recommendations
- **SQS**: Queue for batch job processing
- **SNS**: SMS notifications (optional)
- **EventBridge**: Scheduled daily processing automation
- **Amplify**: Front-end hosting and deployment
