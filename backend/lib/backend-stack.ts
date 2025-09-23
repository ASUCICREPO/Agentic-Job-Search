import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as os from 'os';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { bedrock as bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import { ContextEnrichment } from '@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock';
import * as path from 'path';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ses from 'aws-cdk-lib/aws-ses';


export class jobsearch1 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // basic information retrieval before writing resources
    // Admin email for SES sender identity
    const adminEmail = this.node.tryGetContext('adminEmail');
    if (!adminEmail)
      throw new Error("Missing required context variable: adminEmail. Please provide 'adminEmail' in CDK context (e.g., cdk deploy -c adminEmail=your@email.com)");

    const aws_region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;
    console.log(`AWS Region: ${aws_region}`);

    const hostArchitecture = os.arch();
    console.log(`Host architecture: ${hostArchitecture}`);

    const lambdaArchitecture = hostArchitecture === 'arm64' ? lambda.Architecture.ARM_64 : lambda.Architecture.X86_64;
    console.log(`Lambda architecture: ${lambdaArchitecture}`);

    // Create SES Email Identity
    const senderIdentity = new ses.EmailIdentity(this, 'SenderIdentity', {
      identity: ses.Identity.email(adminEmail),
    });

    const JobsBucket = new s3.Bucket(this, 'JobsBucket', {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const ResumeBucket = new s3.Bucket(this, 'ResumeBucket', {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
          allowedOrigins: ['*'],
          exposedHeaders: []
        }
      ]
    });

    const StudentProfileTable = new dynamodb.Table(this, 'StudentProfileTable', {
      partitionKey: { name: 'actionID', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,  //for production have retain
    });

    // Job Recommendations Table
    // Primary key: email#job_type (e.g., "john@gmail.com#software-engineer")
    const JobRecommendationsTable = new dynamodb.Table(this, 'JobRecommendationsTable', {
      partitionKey: {
        name: 'userJobKey',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // for production have retain
    });

    // Export the table name for reference
    new cdk.CfnOutput(this, 'StudentProfileTableOutput', {
      value: StudentProfileTable.tableName,
      description: 'DynamoDB table for storing student profiles',
      exportName: 'StudentProfileTable',
    });

    const saveProfile = new lambda.Function(this, 'saveProfile', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'save-profile')),
      environment: {
        STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
      },
      architecture: lambdaArchitecture,
    });

    // Add Function URL for direct frontend access
    const saveProfileUrl = saveProfile.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.GET],
        allowedHeaders: ['Content-Type']
      }
    });

    // Lambda function with S3 bucket name from environment variable (ResumeBucket)
    const resumeProcessorLambda = new lambda.Function(this, 'ResumeProcessorLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'resume-parser')),
      environment: {
        RESUME_BUCKET: ResumeBucket.bucketName,
        SAVE_PROFILE_FUNCTION_NAME: saveProfile.functionName,
      },
      architecture: lambdaArchitecture,
    });

    // Add Function URL for direct frontend access to resume parser
    const resumeProcessorUrl = resumeProcessorLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type']
      }
    });

    // Grant Lambda permissions to access the ResumeBucket
    ResumeBucket.grantRead(resumeProcessorLambda);

    // Grant Lambda permissions to invoke Bedrock models
    resumeProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'], // You can restrict to specific model ARNs if needed
    }));

    // Grant resume parser permission to invoke save profile Lambda
    saveProfile.grantInvoke(resumeProcessorLambda);

    // Grant save-profile Lambda permissions to write to DynamoDB
    StudentProfileTable.grantReadWriteData(saveProfile);

    const kb = new bedrock.GraphKnowledgeBase(this, 'JobKnowledgeBase', {
      description: 'Knowledge base with jobs from multiple sources - contains all job listings updated daily',
      embeddingModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: "You are a job search assistant. Help users find relevant job opportunities by searching through job listings. Provide accurate information about job requirements, responsibilities, and company details. Focus on matching user queries with the most relevant job postings.",
    });


    // Skip Docker image build for faster deployment - use existing image
    // const jobSearchAgentImage = new ecrAssets.DockerImageAsset(this, 'JobSearchAgentImage', {
    //   directory: path.join(__dirname, '..', 'JobSearchAgent'),
    //   platform: lambdaArchitecture === lambda.Architecture.ARM_64
    //     ? ecrAssets.Platform.LINUX_ARM64
    //     : ecrAssets.Platform.LINUX_AMD64,
    // });

    new bedrock.S3DataSource(this, 'JobDataSource', {
      bucket: JobsBucket,
      knowledgeBase: kb,
      contextEnrichment: ContextEnrichment.foundationModel({
        enrichmentModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
      }),
    });

    // ENHANCEMENT: Create IAM role for AgentCore with DynamoDB permissions
    // This role allows the Bedrock AgentCore to access DynamoDB tables for saving job recommendations
    // Fixed issue: Replaced non-existent AmazonBedrockExecutionRolePolicy with custom inline policy
    const agentCoreRole = new iam.Role(this, 'AgentCoreExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'IAM role for Bedrock AgentCore to access DynamoDB and other resources',
      inlinePolicies: {
        BedrockExecutionPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              resources: ['arn:aws:logs:*:*:*']
            })
          ]
        })
      }
    });

    // ENHANCEMENT: Grant AgentCore permissions to access DynamoDB tables
    // This allows the job search agent to read user profiles and save job recommendations
    StudentProfileTable.grantReadWriteData(agentCoreRole);
    JobRecommendationsTable.grantReadWriteData(agentCoreRole);

    // ENHANCEMENT: Grant AgentCore permissions to access Knowledge Base and S3
    // This allows the agent to retrieve job data from the knowledge base
    JobsBucket.grantRead(agentCoreRole);

    // Grant AgentCore permissions to invoke Bedrock models
    agentCoreRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:RetrieveAndGenerate',
        'bedrock:Retrieve'
      ],
      resources: ['*']
    }));

    // Grant AgentCore permissions for memory operations
    agentCoreRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:CreateMemory',
        'bedrock:GetMemory',
        'bedrock:UpdateMemory',
        'bedrock:DeleteMemory',
        'bedrock:ListMemories'
      ],
      resources: ['*']
    }));

    // Grant AgentCore permissions to access S3 for knowledge base
    agentCoreRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        JobsBucket.bucketArn,
        `${JobsBucket.bucketArn}/*`
      ]
    }));

    // SQS Queue for job notifications
    const jobNotificationQueue = new sqs.Queue(this, 'JobNotificationQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // Batch Processor Lambda
    const batchProcessorLambda = new lambda.Function(this, 'BatchProcessorLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'batch-processor')),
      timeout: cdk.Duration.minutes(5),
      architecture: lambdaArchitecture,
      environment: {
        // ENHANCEMENT: Updated environment variable name for consistency
        // Changed from DYNAMODB_TABLE_NAME to STUDENT_PROFILE_TABLE_NAME for clarity
        STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
        JOB_RECOMMENDATIONS_TABLE_NAME: JobRecommendationsTable.tableName,
        SQS_QUEUE_URL: jobNotificationQueue.queueUrl,
      },
    });

    // Grant permissions
    StudentProfileTable.grantReadData(batchProcessorLambda);
    JobRecommendationsTable.grantReadWriteData(batchProcessorLambda);
    jobNotificationQueue.grantSendMessages(batchProcessorLambda);

    // EventBridge rule to trigger at 1 AM daily
    const dailyJobProcessingRule = new events.Rule(this, 'DailyJobProcessingRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '8' }),
      description: 'Trigger batch processor at 1 AM MST daily',
    });

    dailyJobProcessingRule.addTarget(new targets.LambdaFunction(batchProcessorLambda));

    // SQS Processor Lambda to consume job notification messages
    const sqsProcessorLambda = new lambda.Function(this, 'SQSProcessorLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'sqs-processor')),
      timeout: cdk.Duration.minutes(5),
      architecture: lambdaArchitecture,
      environment: {
        // ENHANCEMENT: Added comprehensive environment variables for SQS processor
        // These allow the SQS processor to communicate with AgentCore and access DynamoDB
        BEDROCK_AGENTCORE_RUNTIME_ARN: this.node.tryGetContext('agentCoreRuntimeArn') || 'arn:aws:bedrock-agentcore:us-west-2:216989103356:runtime/JOBSEARCHAGENT-LWmC1147BA',
        BEDROCK_AGENTCORE_QUALIFIER: 'DEFAULT',
        STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
        JOB_RECOMMENDATIONS_TABLE_NAME: JobRecommendationsTable.tableName,
        JOB_SEARCH_KB: kb.knowledgeBaseId,
        AGENTCORE_MEMORY_ID: this.node.tryGetContext('agentCoreMemoryId') || 'JobSearchShortTermMemory-yZlDFAGwUg',
        AGENTCORE_USER_PREFERENCE_STRATEGY_ID: this.node.tryGetContext('agentCoreUserPreferenceStrategyId') || 'memory_preference_m405m-1Ogny2Cri1',
        // NOTE: AWS_REGION is automatically provided by Lambda runtime, so not included here
      },
    });

    // ENHANCEMENT: Grant permissions for SQS processor to invoke AgentCore
    // Changed from 'bedrock:InvokeAgent' to 'bedrock-agentcore:InvokeAgentRuntime' for AgentCore compatibility
    sqsProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: ['*'],
    }));

    // ENHANCEMENT: Grant SQS processor access to DynamoDB tables
    // This allows the processor to pass context to AgentCore and verify user profiles
    StudentProfileTable.grantReadData(sqsProcessorLambda);
    JobRecommendationsTable.grantReadWriteData(sqsProcessorLambda);

    // Configure SQS as event source for the processor lambda
    sqsProcessorLambda.addEventSource(new SqsEventSource(jobNotificationQueue, {
      batchSize: 10,
    }));

    // SNS Topic for SMS notifications
    const smsNotificationTopic = new sns.Topic(this, 'SMSNotificationTopic', {
      displayName: 'Job Notification SMS Topic',
    });

    // Notification Sender Lambda for 9 AM daily notifications
    const notificationSenderLambda = new lambda.Function(this, 'NotificationSenderLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'notification-sender')),
      timeout: cdk.Duration.minutes(5),
      architecture: lambdaArchitecture,
      environment: {
        DYNAMODB_TABLE_NAME: StudentProfileTable.tableName,
        JOB_RECOMMENDATIONS_TABLE_NAME: JobRecommendationsTable.tableName,
        SNS_TOPIC_ARN: smsNotificationTopic.topicArn,
        SENDER_EMAIL: adminEmail,
      },
    });

    // Grant permissions for notification sender
    StudentProfileTable.grantReadData(notificationSenderLambda);
    JobRecommendationsTable.grantReadWriteData(notificationSenderLambda);
    smsNotificationTopic.grantPublish(notificationSenderLambda);

    notificationSenderLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    notificationSenderLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: ['*'],
    }));

    // EventBridge rule to trigger notification sender at 9 AM daily
    const dailyNotificationRule = new events.Rule(this, 'DailyNotificationRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '16' }),
      description: 'Send daily notifications at 9 AM MST',
    });

    dailyNotificationRule.addTarget(new targets.LambdaFunction(notificationSenderLambda));

    // Skip Docker image output for faster deployment
    // new cdk.CfnOutput(this, 'DockerImageURI', {
    //   value: jobSearchAgentImage.imageUri,
    //   description: 'Built Docker Image URI (CDK-managed ECR)',
    //   exportName: 'JobSearchAgentImageURI',
    // });

    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: kb.knowledgeBaseId,
      description: 'Knowledge Base ID for job search (passed as build arg to Docker)',
      exportName: 'JobSearchKnowledgeBaseId',
    });

    // Export the table name for reference
    new cdk.CfnOutput(this, 'JobRecommendationsTableName', {
      value: JobRecommendationsTable.tableName,
      description: 'DynamoDB table for storing job recommendations per user',
      exportName: 'JobRecommendationsTableName',
    });

    new cdk.CfnOutput(this, 'ResumeBucketName', {
      value: ResumeBucket.bucketName,
      description: 'S3 bucket for storing user resumes',
      exportName: 'ResumeBucketName',
    });

    new cdk.CfnOutput(this, 'SaveProfileUrl', {
      value: saveProfileUrl.url,
      description: 'Lambda Function URL for save profile endpoint',
      exportName: 'SaveProfileUrl',
    });

    new cdk.CfnOutput(this, 'ResumeProcessorUrl', {
      value: resumeProcessorUrl.url,
      description: 'Lambda Function URL for resume parser endpoint',
      exportName: 'ResumeProcessorUrl',
    });

    new cdk.CfnOutput(this, 'AgentCoreRoleArn', {
      value: agentCoreRole.roleArn,
      description: 'IAM Role ARN for Bedrock AgentCore with DynamoDB permissions',
      exportName: 'AgentCoreRoleArn',
    });

    new cdk.CfnOutput(this, 'SQSQueueUrl', {
      value: jobNotificationQueue.queueUrl,
      description: 'SQS Queue URL for job notifications',
      exportName: 'SQSQueueUrl',
    });

  }
}
