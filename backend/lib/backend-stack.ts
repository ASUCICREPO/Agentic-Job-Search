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
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';


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
      partitionKey: { name: 'sessionID', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'actionID',  type: dynamodb.AttributeType.STRING },
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
      schedule: events.Schedule.cron({ minute: '0', hour: '1' }),
      description: 'Trigger batch processor at 1 AM daily',
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
        AGENT_ID: 'your-agent-id', // TODO: Replace with actual agent ID
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

    // Create IAM role with required permissions
    // const jobSearchAgentRole = new iam.Role(this, 'JobSearchAgentRole', {
    //   assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    //   description: 'IAM role for Job Search Agent with Bedrock AgentCore and ECR permissions',
    //   managedPolicies: [
    //     iam.ManagedPolicy.fromAwsManagedPolicyName('BedrockAgentCoreFullAccess'),
    //     iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
    //     iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
    //   ],
    //   inlinePolicies: {
    //     ECRAndLogsPolicy: new iam.PolicyDocument({
    //       statements: [
    //         new iam.PolicyStatement({
    //           sid: 'ECRReadOnly',
    //           effect: iam.Effect.ALLOW,
    //           actions: [
    //             'ecr:GetAuthorizationToken',
    //             'ecr:BatchCheckLayerAvailability',
    //             'ecr:GetDownloadUrlForLayer',
    //             'ecr:BatchGetImage',
    //             'ecr:ListImages',
    //             'ecr:DescribeRepositories',
    //             'ecr:DescribeImages',
    //           ],
    //           resources: ['*'],
    //         })
    //       ],
    //     }),
    //   },
    // });

    // // Create Lambda function for custom resource to handle AgentCore runtime creation
    // const agentRuntimeCustomResourceLambda = new lambda.Function(this, 'AgentRuntimeCustomResourceLambda', {
    //   runtime: lambda.Runtime.PYTHON_3_11,
    //   handler: 'agent-runtime-custom-resource.lambda_handler',
    //   code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'agent-runtime-custom-resource'), {
    //     bundling: {
    //       image: lambda.Runtime.PYTHON_3_11.bundlingImage,
    //       command: [
    //         'bash', '-c',
    //         'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
    //       ],
    //     },
    //   }),
    //   timeout: cdk.Duration.minutes(5),
    //   architecture: lambdaArchitecture,
    //   environment: {
    //     KNOWLEDGE_BASE_ID: kb.knowledgeBaseId,
    //   },
    //   role: new iam.Role(this, 'AgentRuntimeCustomResourceLambdaRole', {
    //     assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    //     description: 'Lambda execution role for AgentCore runtime custom resource',
    //     managedPolicies: [
    //       iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    //       iam.ManagedPolicy.fromAwsManagedPolicyName('BedrockAgentCoreFullAccess'),
    //     ],
    //     inlinePolicies: {
    //       PassRolePolicy: new iam.PolicyDocument({
    //         statements: [
    //           new iam.PolicyStatement({
    //             sid: 'PassRole',
    //             effect: iam.Effect.ALLOW,
    //             actions: ['iam:PassRole'],
    //             resources: [jobSearchAgentRole.roleArn],
    //           }),
    //           new iam.PolicyStatement({
    //             sid: 'XRayTraceDestination',
    //             effect: iam.Effect.ALLOW,
    //             actions: [
    //               'xray:GetTraceSegmentDestination',
    //               'xray:UpdateTraceSegmentDestination',
    //             ],
    //             resources: ['*'],
    //           }),
    //         ],
    //       }),
    //     },
    //   }),
    // });

    // // Create log group for the provider
    // const providerLogGroup = new logs.LogGroup(this, 'AgentRuntimeProviderLogGroup', {
    //   retention: logs.RetentionDays.TWO_WEEKS,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });

    // // Create custom resource provider
    // const agentRuntimeProvider = new customResources.Provider(this, 'AgentRuntimeProvider', {
    //   onEventHandler: agentRuntimeCustomResourceLambda,
    //   logGroup: providerLogGroup,
    // });

    // // Create the custom resource to manage AgentCore runtime
    // const agentRuntimeResource = new cdk.CustomResource(this, 'JobSearchAgentRuntime', {
    //   serviceToken: agentRuntimeProvider.serviceToken,
    //   properties: {
    //     AgentRuntimeName: 'JobSearchAgent',
    //     ContainerUri: jobSearchAgentImage.imageUri,
    //     RoleArn: jobSearchAgentRole.roleArn,
    //   },
    //   // Custom resource type to ensure proper CloudFormation handling
    //   resourceType: 'Custom::JobSearchAgentRuntime'
    // });

    // // Ensure the custom resource is created after the Docker image is built and role is ready
    // agentRuntimeResource.node.addDependency(jobSearchAgentImage);
    // agentRuntimeResource.node.addDependency(jobSearchAgentRole);   
    
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
