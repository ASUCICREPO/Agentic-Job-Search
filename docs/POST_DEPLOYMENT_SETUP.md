# Post-Deployment Setup Guide

After your deployment is complete (whether via **CodeBuild** or **Manual CDK**), follow these steps to fully configure your AI-Powered ASU Job Search Assistant.

## Prerequisites

- Infrastructure deployment must be completed successfully (via CodeBuild or Manual CDK)
- Access to AWS Console with appropriate permissions
- Note the output values from your deployment (you'll need these for configuration)

## How to Get Values from Your Deployment

### Method 1: CodeBuild Deployment

If you deployed using CodeBuild, follow these steps to get the required values:

#### Step A: Access CodeBuild Console
1. **Navigate to CodeBuild**:
   - Open the AWS Console
   - Search for "CodeBuild" and select "AWS CodeBuild"
   - Click on "Build projects"

2. **Find Your Build**:
   - Look for your project build (it should be named something like "Agentic-Job-Search-Build" or similar)
   - Click on the project name

3. **View Build History**:
   - Click on the "Build history" tab
   - Click on the most recent successful build (Status should show "Succeeded")

#### Step B: Extract Output Values
4. **View Build Logs**:
   - In the build details page, scroll down to find the "Build logs" section
   - Click "View entire log" or look at the log output directly

5. **Find Stack Outputs** (look for these in the build logs):
   - Search for "Stack ARN" or "Outputs" in the logs
   - Look for output values that include:
     - **CareerResourcesBucket**: Something like `carrierresources-randomstring123`
     - **JobSearchKB**: Knowledge base ID for job search
     - **CarrierResourceKB**: Knowledge base ID for career resources  
     - **StudentProfileTableName**: DynamoDB table name for student profiles
     - **JobRecommendationsTableName**: DynamoDB table name for job recommendations
     - **ECR Repository URI**: Docker image URI (looks like `123456789012.dkr.ecr.us-east-1.amazonaws.com/repository-name:latest`)
     - **BedrockAgentCoreExecutionRoleArn**: IAM role ARN for Bedrock AgentCore

### Method 2: Manual CDK Deployment

If you deployed using manual CDK commands, you can get the values in several ways:

#### Option A: From Terminal Output
1. **Check Your Terminal**: 
   - Look at your terminal where you ran `cdk deploy --all`
   - Scroll up to find the stack outputs that were displayed after deployment
   - Look for output values similar to those listed in Step C below

#### Option B: CloudFormation Console
1. **Navigate to CloudFormation**:
   - Go to AWS Console > CloudFormation
   - Find your stack (usually named "BackendStack" or similar)
   - Click on the stack name
   - Go to the "Outputs" tab
   - Copy the values you need from the "Value" column

#### Option C: CDK Command
1. **Use CDK CLI**:
   ```bash
   cd backend
   cdk outputs --all
   ```
   - This will display all stack outputs in your terminal

### Step C: Save Important Values (Both Methods)
Create a notepad/document with these values for easy reference:
```
CareerResourcesBucket: [your-bucket-name]
JobSearchKB: [knowledge-base-id]
CarrierResourceKB: [knowledge-base-id]
StudentProfileTableName: [table-name]
JobRecommendationsTableName: [table-name]
ECR Repository URI: [your-ecr-uri]
BedrockAgentCoreExecutionRoleArn: [role-arn]
AWS Region: [your-deployment-region]
```

**💡 Pro Tip**: Keep this information handy as you'll need it multiple times during the setup process.

## Step 1: Create Knowledge Base

1. **Navigate to Bedrock Knowledge Bases**:
   - Open the AWS Console
   - Search for "Bedrock" and select "Amazon Bedrock"
   - On the left sidebar, click on "Knowledge bases"

2. **Create New Knowledge Base**:
   - Click "Create knowledge base"
   - Select "Knowledge base with vector store"
   - Enter your knowledge base name (any name you prefer)
   - Set data source type to "S3"
   - Click "Next"

3. **Configure S3 Data Source**:
   - Browse S3 buckets and find the "carrierresources" bucket
   - **Use the CareerResourcesBucket value from your deployment outputs** (from Step C above)
   - Select the carrier resources bucket
   - Click "Next"

4. **Configure Embeddings Model**:
   - Select embeddings model: "Titan Text Embeddings V2"
   - Choose "Quick create a new vector store"
   - Click "S3 Vectors"
   - Click "Next"
   - Click "Create knowledge base"

## Step 2: Create AgentCore Memory

1. **Navigate to Bedrock AgentCore**:
   - In the AWS Console, go to "Bedrock AgentCore"
   - On the left sidebar, click on "Memory"

2. **Create Memory**:
   - Click "Create memory"
   - Enter any memory name you prefer
   - Select "User preferences"
   - In the path field, enter: `/strategies/{memoryStrategyId}/actors/{actorId}`
   - Click "Create memory"

3. **Save Important IDs**:
   - After creation, note down the **AGENTCORE_MEMORY_ID** (found under Memory Details)
   - Note down the **AGENTCORE_USER_PREFERENCE_STRATEGY_ID** (found under Long Term Memory Strategies)
   - **Keep these IDs - you'll need them in the next steps**

## Step 3: Host Agent in AgentCore

1. **Navigate to Agent Runtime**:
   - In Bedrock AgentCore, select "Agent runtime" from the left sidebar
   - Click "Host agent"

2. **Configure Agent**:
   - Enter a name for your agent
   - For "Import Docker image from ECR":
     - **Use the ECR Repository URI from your deployment outputs** (from Step C above)
     - Alternatively, browse ECR and find the matching image

3. **Configure IAM Permissions**:
   - Go to "IAM permissions"
   - Select "Use an existing service role"
   - **Use the BedrockAgentCoreExecutionRoleArn from your deployment outputs** (from Step C above)
   - Browse and select the role that matches the ARN from your outputs

4. **Set Environment Variables**:
   Add the following environment variables (get values from your deployment outputs from Step C above):
   - `AGENTCORE_MEMORY_ID` (from Step 2)
   - `AGENTCORE_USER_PREFERENCE_STRATEGY_ID` (from Step 2)
   - `AWS_REGION` (your deployment region)
   - `CARRIER_RESOURCE_KB` (navigate to career_resources KB in Amazon Bedrock and get ID from the details section)
   - `JOB_RECOMMENDATIONS_TABLE_NAME` (from deployment output)
   - `JOB_SEARCH_KB` (from deployment output)
   - `STUDENT_PROFILE_TABLE_NAME` (from deployment output)

5. **Complete Agent Creation**:
   - Review all settings
   - Click "Create agent"
   - **Copy the Agent Runtime ARN** from "View invocation code" - you'll need this next

## Step 4: Update Lambda Environment Variables

You need to update two Lambda functions with the Agent Runtime ARN from Step 3:

### 4A: Update SQS Processor Lambda

1. **Navigate to Lambda**:
   - Search for "Lambda" in the AWS Console
   - Search for "SQSProcessor" function

2. **Update Environment Variables**:
   - Click on the SQSProcessor Lambda function
   - Go to "Configuration" tab
   - Select "Environment variables"
   - Click "Edit"
   - Update `BEDROCK_AGENTCORE_RUNTIME_ARN` with the Agent Runtime ARN from Step 3
   - Click "Save"

### 4B: Update Agent Proxy Lambda

1. **Navigate to Agent Proxy Lambda**:
   - In Lambda console, search for "AgentProxy" function
   - Click on the AgentProxyLambda function

2. **Update Environment Variables**:
   - Go to "Configuration" tab
   - Select "Environment variables"
   - Click "Edit"
   - Update `AGENT_RUNTIME_ARN` with the Agent Runtime ARN from Step 3
   - Click "Save"

**💡 Note**: The Agent Proxy Lambda bypasses Cognito session policy restrictions, allowing unauthenticated users to invoke the Bedrock AgentCore without permission issues. The frontend automatically uses the Agent Proxy URL (set during CDK deployment), so no Amplify environment variable updates are needed.

## Step 5: Upload Data and Sync Knowledge Bases

Before testing your application, you need to upload job postings and career resources, then sync the knowledge bases.

### Upload Files to S3 Buckets

1. **Navigate to S3 Console**:
   - Open the AWS Console
   - Search for "S3" and select "Amazon S3"

2. **Upload Job Postings**:
   - Find and click on your **JobsBucket** (from your deployment outputs)
   - Click "Upload"
   - Add your job posting files
   - Click "Upload" to complete

3. **Upload Career Resources**:
   - Find and click on your **CareerResourcesBucket** (from your deployment outputs)
   - Click "Upload" 
   - Add your career resource files
   - Click "Upload" to complete

### Sync Knowledge Bases

After uploading files, you must sync the knowledge bases to make the data searchable:

1. **Sync Job Search Knowledge Base**:
   - Go to AWS Console > Bedrock > Knowledge bases
   - Find your Job Search knowledge base based on the cdk outputs
   - Click on the knowledge base name
   - Click "Sync" or "Sync data sources" button
   - Wait for the sync to complete (status will show "Syncing" then "Available")

2. **Sync Career Resources Knowledge Base**:
   - In the same Knowledge bases section
   - Find your Career Resources knowledge base that you just created in step 1
   - Click on the knowledge base name
   - Click "Sync" or "Sync data sources" button
   - Wait for the sync to complete (status will show "Syncing" then "Available")

**⚠️ Important Notes**:
- Syncing can take several minutes depending on the amount of data
- Both knowledge bases must show "Available" status before testing
- If sync fails, check that your S3 buckets contain supported file formats
- You can monitor sync progress in the knowledge base details page

## Step 6: SES Email Verification

1. **Check Your Email**:
   - An email will be sent from AWS to the admin email address you provided during deployment
   - If you can't find the email, check your Spam folder and verify by clicking the confirmation link

## Step 7: Access and Use the Application

1. **Access the Frontend**:
   - Go to AWS Console > AWS Amplify
   - Select the app created by the stack
   - Access the application URL provided by Amplify

2. **Using the Application**:
   - **Set up your profile**: Start by creating a profile with optional resume upload
   - **Choose job preferences**: Select your job search preferences (part-time, full-time, internships, etc.)
   - **Use the chat interface**: Ask questions about jobs, internships, or career advice
   - **Receive daily recommendations**: Automated job emails will be sent based on your preferences

## Component Interactions

The application follows this flow when users interact with it:

1. User submits query through chat interface
2. Lambda function processes request and invokes Strands Agents
3. Orchestrator routes to Job Search or Career Advice agents based on intent
4. Job Search agent queries knowledge base with job listings from JobsBucket
5. Career Advice agent queries knowledge base with resources from CareerResourcesBucket
6. AI responses include job listings, career guidance, and source citations
7. Job recommendations are stored in DynamoDB for notifications
8. Automated daily processing generates personalized job matches
9. Email notifications are sent via SES based on user preferences

## Verification Steps

After completing all steps above:

1. **Test Frontend**:
   - Access your Amplify application URL
   - Try the chat interface to ensure it's connecting properly

2. **Test Full Flow**:
   - Create a user profile with resume upload
   - Ask job-related questions in the chat
   - Verify that responses include relevant job listings and career advice
   - Check that job recommendations are being stored (you can verify in DynamoDB console)

## Troubleshooting

- **Knowledge Base Creation Issues**: Ensure the S3 bucket name is exactly as shown in CodeBuild output
- **Agent Runtime Issues**: Verify all environment variables are set correctly
- **Lambda Issues**: Check CloudWatch logs for detailed error messages

## Important Notes

- Keep all the IDs and ARNs noted during this process for future reference
- If you redeploy the infrastructure, you may need to repeat some of these steps
- Environment variables are case-sensitive - ensure exact matches
- Allow a few minutes for changes to propagate after updating environment variables

Your AI-Powered Job Search Assistant should now be fully configured and ready to use!
