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
    const aws_region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;
    console.log(`AWS Region: ${aws_region}`);

    const hostArchitecture = os.arch(); 
    console.log(`Host architecture: ${hostArchitecture}`);
    
    const lambdaArchitecture = hostArchitecture === 'arm64' ? lambda.Architecture.ARM_64 : lambda.Architecture.X86_64;
    console.log(`Lambda architecture: ${lambdaArchitecture}`);

    // Admin email for SES sender identity
    const adminEmail = this.node.tryGetContext('adminEmail');
    
    // Create SES Email Identity
    const senderIdentity = new ses.EmailIdentity(this, 'SenderIdentity', {
      identity: ses.Identity.email(adminEmail),
    });

    const JobsBucket = new s3.Bucket(this, 'JobsBucket', {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, 
    });

    const kb = new bedrock.GraphKnowledgeBase(this, 'JobKnowledgeBase', {
      description: 'Knowledge base with jobs from multiple sources - contains all job listings updated daily',
      embeddingModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: "You are a job search assistant. Help users find relevant job opportunities by searching through job listings. Provide accurate information about job requirements, responsibilities, and company details. Focus on matching user queries with the most relevant job postings.",
    });


    // Build Docker image and push to ECR as part of CDK deployment
    const jobSearchAgentImage = new ecrAssets.DockerImageAsset(this, 'JobSearchAgentImage', {
      directory: path.join(__dirname, '..', 'JobSearchAgent'),
      platform: lambdaArchitecture === lambda.Architecture.ARM_64 
        ? ecrAssets.Platform.LINUX_ARM64 
        : ecrAssets.Platform.LINUX_AMD64,
    });

    new bedrock.S3DataSource(this, 'JobDataSource', {
      bucket: JobsBucket,
      knowledgeBase: kb,
      contextEnrichment: ContextEnrichment.foundationModel({
    enrichmentModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
        }),
    });

    const StudentMemoryContractTable = new dynamodb.Table(this, 'StudentMemoryContractTable', {
      partitionKey: { name: 'actionID', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,  //for production have retain
    });
        
    // Export the table name for reference
    new cdk.CfnOutput(this, 'StudentMemoryContractTableName', {
      value: StudentMemoryContractTable.tableName,
      description: 'DynamoDB table for storing student profiles',
      exportName: 'StudentMemoryContractTableName',
    });

    // SQS Queue for job notifications
    const jobNotificationQueue = new sqs.Queue(this, 'JobNotificationQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // Batch Processor Lambda
    const batchProcessorLambda = new lambda.Function(this, 'BatchProcessorLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'batch_processor.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'batch-processor')),
      timeout: cdk.Duration.minutes(5),
      architecture: lambdaArchitecture,
      environment: {
        DYNAMODB_TABLE_NAME: StudentMemoryContractTable.tableName,
        SQS_QUEUE_URL: jobNotificationQueue.queueUrl,
      },
    });

    // Grant permissions
    StudentMemoryContractTable.grantReadData(batchProcessorLambda);
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
      handler: 'sqs_processor.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'sqs-processor')),
      timeout: cdk.Duration.minutes(5),
      architecture: lambdaArchitecture,
      environment: {
        BEDROCK_AGENT_ID: 'your-agent-id', // TODO: Replace with actual agent ID
        BEDROCK_AGENT_ALIAS_ID: 'your-agent-alias-id', // TODO: Replace with actual agent alias ID
      },
    });

    // Grant permissions for SQS processor
    sqsProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeAgent'],
      resources: ['*'],
    }));

    sqsProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));

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
      handler: 'notification_sender.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'notification-sender')),
      timeout: cdk.Duration.minutes(5),
      architecture: lambdaArchitecture,
      environment: {
        DYNAMODB_TABLE_NAME: StudentMemoryContractTable.tableName,
        SNS_TOPIC_ARN: smsNotificationTopic.topicArn,
        SENDER_EMAIL: adminEmail,
      },
    });

    // Grant permissions for notification sender
    StudentMemoryContractTable.grantReadData(notificationSenderLambda);
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
    
    new cdk.CfnOutput(this, 'DockerImageURI', {
      value: jobSearchAgentImage.imageUri,
      description: 'Built Docker Image URI (CDK-managed ECR)',
      exportName: 'JobSearchAgentImageURI',
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: kb.knowledgeBaseId,
      description: 'Knowledge Base ID for job search (passed as build arg to Docker)',
      exportName: 'JobSearchKnowledgeBaseId',
    });


  }
}
