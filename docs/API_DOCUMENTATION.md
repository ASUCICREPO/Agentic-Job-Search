# ASU Job Search Assistant APIs

APIs for an AI-powered job search and career guidance system that provides personalized job recommendations and career advice for ASU students.

**Base URL**  
https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/

## 1) Profile APIs
Manage user profiles and resume processing.

**POST /profile** — Save or update user profile  
Purpose: Store user profile data including preferences and notification settings  
Request body:
```json
{
  "parsed_data": {
    "fullName": "string",
    "email": "string", 
    "location": "string",
    "preferredJobRole": "string",
    "optInStatus": boolean,
    "communicationMethod": "string"
  }
}
```
Response: JSON with save confirmation and action ID.

**GET /profile** — Retrieve user profile  
Purpose: Get existing user profile by email  
Query parameters: `email` (required)  
Response: JSON with complete profile data or null if not found.

**POST /resume** — Parse resume with AI  
Purpose: Extract structured data from uploaded resume using AWS Bedrock  
Request body:
```json
{
  "s3_path": "string"
}
```
Response: JSON with extracted profile information including skills, experience, and contact details.

## 2) Job Search APIs
AI-powered job discovery and recommendations.

**POST /agent** — Interactive job search  
Purpose: Real-time job search using multi-agent AI system  
Request body:
```json
{
  "prompt": "string",
  "session_id": "string", 
  "email": "string",
  "source": "livesearch"
}
```
Response: Streaming JSON with job results, career advice, and AI reasoning process.

**GET /job-recommendations/{userJobKey}/{createdAt}** — Get saved recommendations  
Purpose: Retrieve job recommendations from daily batch processing  
Path parameters: `userJobKey` (email#category), `createdAt` (timestamp)  
Response: JSON with job listings including fit analysis and job details.

## 3) Career Advice APIs
Professional development guidance and resources.

**POST /career-advice** — Get career guidance  
Purpose: AI-powered career advice with source citations  
Request body:
```json
{
  "query": "string",
  "session_id": "string",
  "email": "string"
}
```
Response: JSON with personalized career advice, actionable steps, and resource links.

## 4) Notification APIs
Daily job alert system for opted-in users.

**POST /batch-process** — Trigger daily job processing  
Purpose: Process all opted-in users for personalized job matching  
Trigger: EventBridge (1 AM MST daily)  
Response: JSON with processing status and user count.

**POST /send-notifications** — Send daily job alerts  
Purpose: Deliver personalized job recommendations via email/SMS  
Trigger: EventBridge (9 AM MST daily)  
Response: JSON with delivery status and notification count.

## Response Format
All APIs return JSON responses with detailed job information, AI-generated fit analysis, and comprehensive status information for successful matches and career guidance.