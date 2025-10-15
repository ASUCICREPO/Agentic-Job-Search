import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as os from "os";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { bedrock as bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { ContextEnrichment } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import * as path from "path";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ses from "aws-cdk-lib/aws-ses";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as amplify from "@aws-cdk/aws-amplify-alpha";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, } from "aws-cdk-lib/custom-resources";
import * as cognito from "aws-cdk-lib/aws-cognito";

export class jobsearch1 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // basic information retrieval before writing resources
    // Admin email for SES sender identity
    const senderEmail = this.node.tryGetContext("senderEmail");
    const githubToken = this.node.tryGetContext("githubToken");
    const githubOwner = this.node.tryGetContext("githubOwner");
    const githubRepo = this.node.tryGetContext("githubRepo");
    const senderNumber = this.node.tryGetContext("senderNumber");


    if (!senderEmail || !githubToken || !githubOwner || !githubRepo || !senderNumber)
      throw new Error(
        "Missing required context variable(s): senderEmail, githubToken, githubOwner, githubRepo, and/or senderNumber. Please provide all in CDK context (e.g., cdk deploy -c senderEmail=your@email.com -c githubToken=your_github_token -c githubOwner=your_github_owner -c githubRepo=your_github_repo -c senderNumber=+1234567890)"
      );

    const aws_region = cdk.Stack.of(this).region;
    console.log(`AWS Region: ${aws_region}`);

    const hostArchitecture = os.arch();
    console.log(`Host architecture: ${hostArchitecture}`);

    const timestamp = Date.now();

    const lambdaArchitecture =
      hostArchitecture === "arm64"
        ? lambda.Architecture.ARM_64
        : lambda.Architecture.X86_64;
    console.log(`Lambda architecture: ${lambdaArchitecture}`);

    const githubToken_secret_manager = new secretsmanager.Secret(
      this,
      "GitHubToken",
      {
        secretName: "github-secret-token",
        description: "GitHub Personal Access Token for Amplify",
        secretStringValue: cdk.SecretValue.unsafePlainText(githubToken),
      }
    );

    // Create SES Email Identity
    const senderIdentity = new ses.EmailIdentity(this, "SenderIdentity", {
      identity: ses.Identity.email(senderEmail),
    });

    const JobsBucket = new s3.Bucket(this, "JobsBucket", {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const ResumeBucket = new s3.Bucket(this, "ResumeBucket", {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ["*"],
          exposedHeaders: [],
        },
      ],
    });

    const carrierResourcesBucket = new s3.Bucket(this, "carrierResourcesBucket", {
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false, // Allow bucket policies
        restrictPublicBuckets: false, // Allow public bucket policies
      }),
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ["*"],
          exposedHeaders: [],
        },
      ],
    });

    // Create placeholder files to establish folder structure
    const prefixes = ['public/', 'private/'];

    prefixes.forEach(prefix => {
      new s3deploy.BucketDeployment(this, `Deploy${prefix.replace('/', '')}`, {
        sources: [s3deploy.Source.data(" ", `${prefix.replace('/', '')}.placeholder`)],
        destinationBucket: carrierResourcesBucket,
        destinationKeyPrefix: prefix,
      })
    });

    // Add bucket policy to allow public read access to public/ folder
    carrierResourcesBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        actions: ["s3:GetObject"],
        resources: [`${carrierResourcesBucket.bucketArn}/public/*`],
      })
    );

    const StudentProfileTable = new dynamodb.Table(
      this,
      "StudentProfileTable",
      {
        partitionKey: { name: "actionID", type: dynamodb.AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY, //for production have retain
      }
    );

    // Job Recommendations Table
    // Primary key: email#job_type (e.g., "john@gmail.com#software-engineer")
    const JobRecommendationsTable = new dynamodb.Table(
      this,
      "JobRecommendationsTable",
      {
        partitionKey: {
          name: "userJobKey",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "createdAt",
          type: dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY, // for production have retain
      }
    );



    // API Gateway with direct DynamoDB integration for job recommendations
    const jobRecommendationsApi = new apigateway.RestApi(this, 'JobRecommendationsApi', {
      restApiName: 'job-recommendations-api',
      description: 'Direct API for retrieving job recommendations from SMS links',
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.OFF, // Disable logging to avoid CloudWatch role requirement
        dataTraceEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Create IAM role for API Gateway to access DynamoDB
    const apiGatewayDynamoDBRole = new iam.Role(this, 'ApiGatewayDynamoDBRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    // Grant the role permission to read from JobRecommendationsTable
    JobRecommendationsTable.grantReadData(apiGatewayDynamoDBRole);

    // Create resource path: /job-recommendations/{userJobKey}/{createdAt}
    const jobRecommendationsResource = jobRecommendationsApi.root.addResource('job-recommendations');
    const userJobKeyResource = jobRecommendationsResource.addResource('{userJobKey}');
    const createdAtResource = userJobKeyResource.addResource('{createdAt}');

    // Add GET method with direct DynamoDB integration
    createdAtResource.addMethod('GET', new apigateway.AwsIntegration({
      service: 'dynamodb',
      action: 'Query',
      options: {
        credentialsRole: apiGatewayDynamoDBRole,
        requestTemplates: {
          'application/json': `{
            "TableName": "${JobRecommendationsTable.tableName}",
            "KeyConditionExpression": "userJobKey = :userJobKey",
            "ExpressionAttributeValues": {
              ":userJobKey": {
                "S": "$util.urlDecode($input.params('userJobKey'))"
              }
            },
            "ScanIndexForward": false,
            "Limit": 1
          }`
        },
        integrationResponses: [{
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'"
          },
          responseTemplates: {
            'application/json': `{
              "userJobKey": "$input.path('$.Items[0].userJobKey.S')",
              "createdAt": "$input.path('$.Items[0].createdAt.S')",
              "email": "$input.path('$.Items[0].email.S')",
              "jobCategory": "$input.path('$.Items[0].jobCategory.S')",
              "jobInformation": $input.json('$.Items[0].jobInformation')
            }`
          }
        }, {
          statusCode: '404',
          selectionPattern: '.*"__type":"com.amazon.coral.validate#ValidationException".*',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'"
          },
          responseTemplates: {
            'application/json': JSON.stringify({
              error: 'Job recommendation not found',
              userJobKey: '',
              createdAt: '',
              email: '',
              jobCategory: '',
              jobInformation: []
            })
          }
        }]
      }
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true
          }
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true
          }
        }
      ]
    });

    const saveProfile = new lambda.Function(this, "saveProfile", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "index.lambda_handler",
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "lambda", "save-profile")
      ),
      environment: {
        STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
      },
      architecture: lambdaArchitecture,
    });

    // Add Function URL for direct frontend access
    const saveProfileUrl = saveProfile.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.GET],
        allowedHeaders: ["Content-Type"],
      },
    });

    // Lambda function with S3 bucket name from environment variable (ResumeBucket)
    const resumeProcessorLambda = new lambda.Function(
      this,
      "ResumeProcessorLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: "index.handler",
        timeout: cdk.Duration.minutes(5),
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "lambda", "resume-parser")
        ),
        environment: {
          RESUME_BUCKET: ResumeBucket.bucketName,
          SAVE_PROFILE_FUNCTION_NAME: saveProfile.functionName,
        },
        architecture: lambdaArchitecture,
      }
    );

    // Add Function URL for direct frontend access to resume parser
    const resumeProcessorUrl = resumeProcessorLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["Content-Type"],
      },
    });

    // Grant Lambda permissions to access the ResumeBucket
    ResumeBucket.grantRead(resumeProcessorLambda);

    // Grant Lambda permissions to invoke Bedrock models
    resumeProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // You can restrict to specific model ARNs if needed
      })
    );

    // Grant resume parser permission to invoke save profile Lambda
    saveProfile.grantInvoke(resumeProcessorLambda);

    // Grant save-profile Lambda permissions to write to DynamoDB
    StudentProfileTable.grantReadWriteData(saveProfile);

    // Agent Proxy Lambda - Handles agent invocations via HTTP
    const agentProxyLambda = new lambda.Function(this, "AgentProxyLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromAsset(
        path.join(__dirname, "..", "lambda", "agent-proxy")
      ),
      environment: {
        AGENT_RUNTIME_ARN: "MANUALLY_ADD_HERE", // Will be updated after agent deployment
        AGENT_QUALIFIER: "DEFAULT",
      },
      architecture: lambdaArchitecture,
    });

    // Grant Agent Proxy Lambda permission to invoke Bedrock AgentCore
    agentProxyLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock-agentcore:InvokeAgentRuntime"],
        resources: ["*"],
      })
    );

    // Add Function URL for direct frontend access
    const agentProxyUrl = agentProxyLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["Content-Type"],
      },
    });

    const kb = new bedrock.GraphKnowledgeBase(this, "JobKnowledgeBase", {
      description: "Knowledge base with jobs from multiple sources - contains all job listings updated daily",
      embeddingModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: "You are a job search assistant. Help users find relevant job opportunities by searching through job listings. Provide accurate information about job requirements, responsibilities, and company details. Focus on matching user queries with the most relevant job postings.",
    });

    // Skip Docker image build for faster deployment - use existing image
    const jobSearchAgentImage = new ecrAssets.DockerImageAsset(
      this,
      "JobSearchAgentImage",
      {
        directory: path.join(__dirname, "..", "JobSearchAgent"),
        platform:
          lambdaArchitecture === lambda.Architecture.ARM_64
            ? ecrAssets.Platform.LINUX_ARM64
            : ecrAssets.Platform.LINUX_AMD64,
      }
    );

    new bedrock.S3DataSource(this, "JobDataSource", {
      bucket: JobsBucket,
      knowledgeBase: kb,
      chunkingStrategy: bedrock.ChunkingStrategy.fixedSize({
        maxTokens: 1500,
        overlapPercentage: 20, // 20% overlap between chunks for better context continuity
      }),
      contextEnrichment: ContextEnrichment.foundationModel({
        enrichmentModel:
          bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
      }),
    });

    // SQS Queue for job notifications
    const jobNotificationQueue = new sqs.Queue(this, "JobNotificationQueue", {
      visibilityTimeout: cdk.Duration.minutes(16), // Must be greater than Lambda timeout (15 min)
    });

    // Batch Processor Lambda
    const batchProcessorLambda = new lambda.Function(
      this,
      "BatchProcessorLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "lambda", "batch-processor")
        ),
        timeout: cdk.Duration.minutes(5),
        architecture: lambdaArchitecture,
        environment: {
          STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
          SQS_QUEUE_URL: jobNotificationQueue.queueUrl,
        },
      }
    );

    // Grant permissions
    StudentProfileTable.grantReadData(batchProcessorLambda);
    JobRecommendationsTable.grantReadWriteData(batchProcessorLambda);
    jobNotificationQueue.grantSendMessages(batchProcessorLambda);

    // EventBridge rule to trigger at 1 AM daily
    const dailyJobProcessingRule = new events.Rule(
      this,
      "DailyJobProcessingRule",
      {
        schedule: events.Schedule.cron({ minute: "0", hour: "8" }),
        description: "Trigger batch processor at 1 AM MST daily",
      }
    );

    dailyJobProcessingRule.addTarget(
      new targets.LambdaFunction(batchProcessorLambda)
    );

    // SQS Processor Lambda to consume job notification messages
    const sqsProcessorLambda = new lambda.Function(this, "SQSProcessorLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "index.lambda_handler",
      code: lambda.Code.fromDockerBuild(
        path.join(__dirname, "..", "lambda", "sqs-processor")
      ),
      timeout: cdk.Duration.minutes(15),
      architecture: lambdaArchitecture,
      environment: {
        BEDROCK_AGENTCORE_RUNTIME_ARN: "MANUALLY_ADD_HERE", // One manual step to be done later
        BEDROCK_AGENTCORE_QUALIFIER: "DEFAULT",
      },
    });

    // Changed from 'bedrock:InvokeAgent' to 'bedrock-agentcore:InvokeAgentRuntime' for AgentCore compatibility
    sqsProcessorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock-agentcore:InvokeAgentRuntime"],
        resources: ["*"],
      })
    );

    // Configure SQS as event source for the processor lambda
    sqsProcessorLambda.addEventSource(
      new SqsEventSource(jobNotificationQueue, {
        batchSize: 10,
      })
    );

    // Notification Sender Lambda for 9 AM daily notifications
    const notificationSenderLambda = new lambda.Function(
      this,
      "NotificationSenderLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: "index.lambda_handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "..", "lambda", "notification-sender")
        ),
        timeout: cdk.Duration.minutes(5),
        architecture: lambdaArchitecture,
        environment: {
          STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
          JOB_RECOMMENDATIONS_TABLE_NAME: JobRecommendationsTable.tableName,
          SENDER_EMAIL: senderEmail,
          SMS_ORIGINATION_NUMBER: senderNumber,
          // The environment variable for amplify is addded after amplify is created
        },
      }
    );

    notificationSenderLambda.node.addDependency(senderIdentity);

    // Grant permissions for notification sender
    StudentProfileTable.grantReadData(notificationSenderLambda);
    JobRecommendationsTable.grantReadWriteData(notificationSenderLambda);

    notificationSenderLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    // Grant SMS Voice v2 permissions
    notificationSenderLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "sms-voice:SendTextMessage",
          "sms-voice:SendVoiceMessage",
          "sms-voice:DescribeConfigurationSets",
          "sms-voice:DescribePools",
          "sms-voice:ListPools",
          "sms-voice:DescribePhoneNumbers",
          "sms-voice:ListPoolOriginationIdentities"
        ],
        resources: ["*"],
      })
    );

    // EventBridge rule to trigger notification sender at 9 AM daily
    const dailyNotificationRule = new events.Rule(
      this,
      "DailyNotificationRule",
      {
        schedule: events.Schedule.cron({ minute: "0", hour: "16" }),
        description: "Send daily notifications at 9 AM MST",
      }
    );

    dailyNotificationRule.addTarget(
      new targets.LambdaFunction(notificationSenderLambda)
    );
    // Create IAM role for Bedrock AgentCore execution
    const bedrockAgentCoreExecutionRole = new iam.Role(this, "BedrockAgentCoreExecutionRole", {
      roleName: "BedrockAgentCoreExecutionRole",
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
    });

    // Attach managed policies
    bedrockAgentCoreExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess")
    );
    bedrockAgentCoreExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess_v2")
    );
    bedrockAgentCoreExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("BedrockAgentCoreFullAccess")
    );

    // Add full access policies for logs, ECR, X-Ray, and CloudWatch
    bedrockAgentCoreExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:*",
          "ecr:*",
          "xray:*",
          "cloudwatch:*",
        ],
        resources: ["*"],
      })
    );

    // Create Cognito Identity Pool for unauthenticated (guest) access
    const identityPool = new cognito.CfnIdentityPool(this, "JobSearchIdentityPool", {
      identityPoolName: `jobsearch-identity-pool-${timestamp}`,
      allowUnauthenticatedIdentities: true,
    });

    // Create IAM role for unauthenticated users with minimal permissions
    const unauthenticatedRole = new iam.Role(this, "UnauthenticatedRole", {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    // Grant S3 write access to resume bucket
    ResumeBucket.grantWrite(unauthenticatedRole);

    // Attach roles to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthenticatedRole.roleArn,
      },
    });

    const amplifyApp = new amplify.App(this, "AmplifyFrontendUI", {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: githubOwner,
        repository: githubRepo,
        oauthToken: githubToken_secret_manager.secretValue,
      }),
      buildSpec: cdk.aws_codebuild.BuildSpec.fromObjectToYaml({
        version: "1.0",
        frontend: {
          phases: {
            preBuild: {
              commands: ["cd frontend", "npm ci"],
            },
            build: {
              commands: ["npm run build"],
            },
          },
          artifacts: {
            baseDirectory: "frontend/build",
            files: ["**/*"],
          },
          cache: {
            paths: ["frontend/node_modules/**/*"],
          },
        },
      }),
      customRules: [
        {
          source:
            "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>",
          target: "/index.html",
          status: amplify.RedirectStatus.REWRITE,
        },
        {
          source: "/job-options",
          target: "/index.html",
          status: amplify.RedirectStatus.REWRITE,
        },
        {
          source: "/chatbot",
          target: "/index.html",
          status: amplify.RedirectStatus.REWRITE,
        },
        {
          source: "/unsubscribe",
          target: "/index.html",
          status: amplify.RedirectStatus.REWRITE,
        },
      ],
    });

    const mainBranch = amplifyApp.addBranch("main", {
      autoBuild: true,
      stage: "PRODUCTION",
    });

    // Create Amplify app URL constant (branch-specific URL)
    const amplifyAppUrl = `https://${mainBranch.branchName}.${amplifyApp.defaultDomain}`;

    // Add AMPLIFY_APP_URL to notification sender Lambda using the branch-specific URL
    notificationSenderLambda.addEnvironment('AMPLIFY_APP_URL', amplifyAppUrl);

    githubToken_secret_manager.grantRead(amplifyApp);

    new AwsCustomResource(this, "TriggerAmplifyBuild", {
      onCreate: {
        service: "Amplify",
        action: "startJob",
        parameters: {
          appId: amplifyApp.appId,
          branchName: mainBranch.branchName, // e.g. "main"
          jobType: "RELEASE", // or REBUILD / RETRY / etc.
        },
        // ensure a new physical ID on every deploy so it actually runs each time
        physicalResourceId: PhysicalResourceId.of(
          `${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`
        ),
      },
      // if you also want it on updates:
      onUpdate: {
        service: "Amplify",
        action: "startJob",
        parameters: {
          appId: amplifyApp.appId,
          branchName: mainBranch.branchName,
          jobType: "RELEASE",
        },
        physicalResourceId: PhysicalResourceId.of(
          `${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`
        ),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          // the app itself
          `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyApp.appId}`,
          // allow startJob on any branch/job under your "main" branch
          `arn:aws:amplify:${this.region}:${this.account}:apps/${amplifyApp.appId}/branches/${mainBranch.branchName}/jobs/*`,
        ],
      }),
    });

    // Add environment variables to Amplify branch
    mainBranch.addEnvironment('REACT_APP_AGENT_QUALIFIER', 'DEFAULT');
    mainBranch.addEnvironment('REACT_APP_AGENT_RUNTIME_ARN', 'MANUALLY ADD HERE');
    mainBranch.addEnvironment('REACT_APP_AWS_REGION', aws_region);
    mainBranch.addEnvironment('REACT_APP_AGENT_PROXY_URL', agentProxyUrl.url);
    mainBranch.addEnvironment('REACT_APP_RESUME_PROCESSOR_URL', resumeProcessorUrl.url);
    mainBranch.addEnvironment('REACT_APP_SAVE_PROFILE_URL', saveProfileUrl.url);
    mainBranch.addEnvironment('REACT_APP_JOB_RECOMMENDATIONS_API_URL', jobRecommendationsApi.url);
    mainBranch.addEnvironment('REACT_APP_RESUME_BUCKET', ResumeBucket.bucketName);
    mainBranch.addEnvironment('REACT_APP_COGNITO_IDENTITY_POOL_ID', identityPool.ref);


    new cdk.CfnOutput(this, "DockerImageURI", {
      value: jobSearchAgentImage.imageUri,
      description: "Built Docker Image URI (CDK-managed ECR)",
      exportName: "JobSearchAgentImageURI",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: kb.knowledgeBaseId,
      description:
        "Knowledge Base ID for job search (passed as build arg to Docker)",
      exportName: "JobSearchKnowledgeBaseId",
    });

    // Export the table name for reference
    new cdk.CfnOutput(this, "JobRecommendationsTableName", {
      value: JobRecommendationsTable.tableName,
      description: "DynamoDB table for storing job recommendations per user",
      exportName: "JobRecommendationsTableName",
    });

    new cdk.CfnOutput(this, "ResumeBucketName", {
      value: ResumeBucket.bucketName,
      description: "S3 bucket for storing user resumes",
      exportName: "ResumeBucketName",
    });

    new cdk.CfnOutput(this, "CarrierResourcesBucketName", {
      value: carrierResourcesBucket.bucketName,
      description: "S3 bucket for carrier resources with public/ and private/ folders",
      exportName: "CarrierResourcesBucketName",
    });

    new cdk.CfnOutput(this, "SaveProfileUrl", {
      value: saveProfileUrl.url,
      description: "Lambda Function URL for save profile endpoint",
      exportName: "SaveProfileUrl",
    });

    new cdk.CfnOutput(this, "ResumeProcessorUrl", {
      value: resumeProcessorUrl.url,
      description: "Lambda Function URL for resume parser endpoint",
      exportName: "ResumeProcessorUrl",
    });

    new cdk.CfnOutput(this, "AgentProxyUrl", {
      value: agentProxyUrl.url,
      description: "Lambda Function URL for agent proxy endpoint",
      exportName: "AgentProxyUrl",
    });


    new cdk.CfnOutput(this, "JobRecommendationsApiUrl", {
      value: jobRecommendationsApi.url,
      description: "API Gateway URL for job recommendations lookup from SMS links",
      exportName: "JobRecommendationsApiUrl",
    });

    new cdk.CfnOutput(this, "SQSQueueUrl", {
      value: jobNotificationQueue.queueUrl,
      description: "SQS Queue URL for job notifications",
      exportName: "SQSQueueUrl",
    });

    // SMS Voice v2 details
    new cdk.CfnOutput(this, "SMSOriginationNumber", {
      value: senderNumber,
      description: "SMS Origination Number for job notifications (existing TEN_DLC number)",
      exportName: "SMSOriginationNumber",
    });

    // Export the table name for reference
    new cdk.CfnOutput(this, "StudentProfileTableOutput", {
      value: StudentProfileTable.tableName,
      description: "DynamoDB table for storing student profiles",
      exportName: "StudentProfileTable",
    });

    // Export Cognito Identity Pool ID
    new cdk.CfnOutput(this, "CognitoIdentityPoolId", {
      value: identityPool.ref,
      description: "Cognito Identity Pool ID for unauthenticated access with minimal AgentCore permissions",
      exportName: "CognitoIdentityPoolId",
    });

    // Export the role ARN
    new cdk.CfnOutput(this, "BedrockAgentCoreExecutionRoleArn", {
      value: bedrockAgentCoreExecutionRole.roleArn,
      description: "IAM role ARN for Bedrock AgentCore execution",
      exportName: "BedrockAgentCoreExecutionRoleArn",
    });

    // Export Amplify app URL (branch-specific)
    new cdk.CfnOutput(this, "AmplifyAppUrl", {
      value: amplifyAppUrl,
      description: "Amplify app URL for SMS links and frontend access (branch-specific)",
      exportName: "AmplifyAppUrl",
    });
  }
}
