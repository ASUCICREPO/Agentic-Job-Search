# ASU Job Search Assistant API Documentation

An AI-powered job search and career guidance system that provides personalized job recommendations and career advice for ASU students using AWS Lambda Function URLs and Bedrock AgentCore.

## Architecture Overview

This system uses a **Lambda Function URL + Bedrock AgentCore** architecture rather than traditional REST APIs:
- **Lambda Function URLs**: Direct HTTP access to Lambda functions for profile management
- **Bedrock AgentCore**: AI-powered job search and career advice through SDK integration
- **API Gateway**: Single endpoint for retrieving saved job recommendations
- **EventBridge**: Automated daily processing and notifications

## 1) Profile Management (Lambda Function URLs)

**Note**: Each Lambda function has its own unique Function URL. There are no paths - requests go directly to the root of each Function URL.

**POST** `{LAMBDA_FUNCTION_URL}` — Save or update user profile
Purpose: Store user profile data including preferences and notification settings
**CORS**: Enabled for all origins with POST/GET methods
Request body:
```json
{
  "parsed_data": {
    "fullName": "string",
    "email": "string (required)",
    "location": "string",
    "preferredJobRole": "string",
    "optInStatus": boolean,
    "communicationMethod": "string",
    "headline": "string",
    "aboutMe": "string",
    "education": "string",
    "experience": "string",
    "phone": "string",
    "linkedin": "string"
  }
}
```
**Response Examples:**
- `200`: `{"message": "Student profile saved successfully", "action_id": "sanitized_email_id"}`
- `400`: `{"error": "Request body is required"}` or `{"error": "Email is required"}`
- `500`: `{"error": "Error message", "message": "Failed to process profile request"}`

**GET** `{LAMBDA_FUNCTION_URL}?email={email}` — Retrieve user profile
Purpose: Get existing user profile by email
Query parameters: `email` (required)
**Response Examples:**
- `200`: `{"message": "Profile retrieved successfully", "profile": {...}}`
- `404`: `{"message": "Profile not found", "profile": null}`
- `400`: `{"error": "Email parameter is required for GET request"}`

**POST** `{RESUME_LAMBDA_FUNCTION_URL}` — Parse resume with AI
Purpose: Extract structured data from uploaded resume using AWS Bedrock Nova Pro
**CORS**: Enabled for all origins with POST method
Request body:
```json
{
  "s3_path": "s3://bucket-name/path/to/resume.pdf"
}
```
**Response Examples:**
- `200`: `{"success": true, "parsed_data": {...}, "message": "Resume parsed successfully"}`
- `500`: `{"success": false, "error": "Error message", "message": "Failed to parse resume"}`

## 2) Job Search & Career Advice (Bedrock AgentCore Integration)

**Note**: Job search and career advice are handled through Bedrock AgentCore runtime integration, not direct REST endpoints. These are accessed via:

- **Interactive Search**: Frontend integrates directly with AgentCore using AWS SDK
- **Batch Processing**: Automated daily processing through SQS → AgentCore pipeline

### AgentCore Integration Details:
- **Runtime ARN**: Uses Bedrock AgentCore runtime for AI-powered responses
- **Session Management**: Requires 33+ character session IDs for proper tracking
- **Streaming Responses**: Server-Sent Events (SSE) format: "data: {json}\n\n"
- **Multi-Agent System**: Orchestrator routes to specialized Job Search and Career Advice agents
- **Timeout**: 15-minute timeout for complex processing
- **Memory Integration**: Conversation history and preferences stored via AgentCore Memory

### Available AgentCore Capabilities:
- Real-time job search with personalized recommendations
- Career advice with source citations and actionable steps
- Resume-based job matching and fit analysis
- Knowledge base integration for job listings and career resources
- User profile integration for enhanced personalization
- Session-based conversation continuity

### Integration Methods:
1. **Frontend SDK Integration**: Direct AWS SDK calls to AgentCore runtime
2. **SQS Processing**: Batch jobs use SQS → Lambda → AgentCore pipeline
3. **Payload Format**:
```json
{
  "prompt": "Enhanced job search query with user profile data",
  "email": "user@asu.edu",
  "session_id": "33+ character session identifier",
  "source": "livesearch" | "batch"
}
```

## 3) Job Recommendations Retrieval (API Gateway)

**GET** `{API_GATEWAY_URL}/job-recommendations/{userJobKey}/{createdAt}` — Get saved recommendations
Purpose: Retrieve job recommendations from daily batch processing (used in SMS links)
Path parameters:
- `userJobKey`: Format `email#category`
- `createdAt`: Timestamp from batch processing
Response: JSON with job listings including fit analysis and job details.

## 4) Automated Processing (EventBridge Triggers)

**Daily Batch Processing** — Automated daily job matching
- **Trigger**: EventBridge scheduled rule (1 AM MST daily)
- **Function**: `batch-processor` Lambda
- **Process**: Scans opted-in users → Sends to SQS → AgentCore processing
- **Output**: Personalized job recommendations saved to DynamoDB

**Daily Notifications** — Automated notification delivery
- **Trigger**: EventBridge scheduled rule (9 AM MST daily)
- **Function**: `notification-sender` Lambda
- **Process**: Retrieves saved recommendations → Sends via email/SMS
- **Output**: Delivered notifications with job recommendations and links

## Authentication & Security

- **Lambda Function URLs**: No authentication required (authType: NONE)
- **CORS**: All Function URLs have CORS enabled for cross-origin requests
- **API Gateway**: No authentication for job recommendations endpoint
- **Data Sanitization**: Email addresses are sanitized for safe storage as DynamoDB keys

## Error Handling

All endpoints return standardized HTTP status codes:
- **200**: Success
- **400**: Bad Request (missing/invalid parameters)
- **404**: Not Found (profile/recommendations not found)
- **405**: Method Not Allowed (unsupported HTTP method)
- **500**: Internal Server Error (processing failures)

## Response Format
All APIs return JSON responses with detailed job information, AI-generated fit analysis, and comprehensive status information for successful matches and career guidance.