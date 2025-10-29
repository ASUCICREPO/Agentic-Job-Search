"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsearch1 = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const aws_lambda_event_sources_1 = require("aws-cdk-lib/aws-lambda-event-sources");
const ecrAssets = __importStar(require("aws-cdk-lib/aws-ecr-assets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const os = __importStar(require("os"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const generative_ai_cdk_constructs_1 = require("@cdklabs/generative-ai-cdk-constructs");
const bedrock_1 = require("@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock");
const path = __importStar(require("path"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const ses = __importStar(require("aws-cdk-lib/aws-ses"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const amplify = __importStar(require("@aws-cdk/aws-amplify-alpha"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const custom_resources_1 = require("aws-cdk-lib/custom-resources");
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
class jobsearch1 extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // basic information retrieval before writing resources
        // Admin email for SES sender identity
        const senderEmail = this.node.tryGetContext("senderEmail");
        const githubToken = this.node.tryGetContext("githubToken");
        const githubOwner = this.node.tryGetContext("githubOwner");
        const githubRepo = this.node.tryGetContext("githubRepo");
        const senderNumber = this.node.tryGetContext("senderNumber");
        if (!senderEmail || !githubToken || !githubOwner || !githubRepo || !senderNumber)
            throw new Error("Missing required context variable(s): senderEmail, githubToken, githubOwner, githubRepo, and/or senderNumber. Please provide all in CDK context (e.g., cdk deploy -c senderEmail=your@email.com -c githubToken=your_github_token -c githubOwner=your_github_owner -c githubRepo=your_github_repo -c senderNumber=+1234567890)");
        const aws_region = cdk.Stack.of(this).region;
        console.log(`AWS Region: ${aws_region}`);
        const hostArchitecture = os.arch();
        console.log(`Host architecture: ${hostArchitecture}`);
        const timestamp = Date.now();
        const lambdaArchitecture = hostArchitecture === "arm64"
            ? lambda.Architecture.ARM_64
            : lambda.Architecture.X86_64;
        console.log(`Lambda architecture: ${lambdaArchitecture}`);
        const githubToken_secret_manager = new secretsmanager.Secret(this, "GitHubToken", {
            secretName: "github-secret-token",
            description: "GitHub Personal Access Token for Amplify",
            secretStringValue: cdk.SecretValue.unsafePlainText(githubToken),
        });
        // Create Amplify app early for CORS configuration
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
                    source: "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>",
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
        // Create Amplify app URL constant for CORS
        const amplifyAppUrl = amplifyApp.appId
            ? `https://main.${amplifyApp.appId}.amplifyapp.com`
            : "*";
        console.log(`Frontend URL for CORS: ${amplifyAppUrl}`);
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
                    allowedOrigins: [amplifyAppUrl, "http://localhost:3000"],
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
                    allowedOrigins: [amplifyAppUrl, "http://localhost:3000"],
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
            });
        });
        // Add bucket policy to allow public read access to public/ folder
        carrierResourcesBucket.addToResourcePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ["s3:GetObject"],
            resources: [`${carrierResourcesBucket.bucketArn}/public/*`],
        }));
        const StudentProfileTable = new dynamodb.Table(this, "StudentProfileTable", {
            partitionKey: { name: "actionID", type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY, //for production have retain
        });
        // Job Recommendations Table
        // Primary key: email#job_type (e.g., "john@gmail.com#software-engineer")
        const JobRecommendationsTable = new dynamodb.Table(this, "JobRecommendationsTable", {
            partitionKey: {
                name: "userJobKey",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "createdAt",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY, // for production have retain
        });
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
            code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", "save-profile")),
            environment: {
                STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
            },
            architecture: lambdaArchitecture,
        });
        // Add Function URL for direct frontend access
        const saveProfileUrl = saveProfile.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: [amplifyAppUrl, "http://localhost:3000"],
                allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.GET],
                allowedHeaders: ["Content-Type"],
            },
        });
        // Lambda function with S3 bucket name from environment variable (ResumeBucket)
        const resumeProcessorLambda = new lambda.Function(this, "ResumeProcessorLambda", {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: "index.handler",
            timeout: cdk.Duration.minutes(5),
            code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", "resume-parser")),
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
                allowedOrigins: [amplifyAppUrl, "http://localhost:3000"],
                allowedMethods: [lambda.HttpMethod.POST],
                allowedHeaders: ["Content-Type"],
            },
        });
        // Grant Lambda permissions to access the ResumeBucket
        ResumeBucket.grantRead(resumeProcessorLambda);
        // Grant Lambda permissions to invoke Bedrock models
        resumeProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["bedrock:InvokeModel"],
            resources: ["*"], // You can restrict to specific model ARNs if needed
        }));
        // Grant resume parser permission to invoke save profile Lambda
        saveProfile.grantInvoke(resumeProcessorLambda);
        // Grant save-profile Lambda permissions to write to DynamoDB
        StudentProfileTable.grantReadWriteData(saveProfile);
        // Agent Proxy Lambda - Handles agent invocations via HTTP
        const agentProxyLambda = new lambda.Function(this, "AgentProxyLambda", {
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: "index.handler",
            timeout: cdk.Duration.minutes(5),
            code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", "agent-proxy")),
            environment: {
                AGENT_RUNTIME_ARN: "",
                AGENT_QUALIFIER: "DEFAULT",
            },
            architecture: lambdaArchitecture,
        });
        // Grant Agent Proxy Lambda permission to invoke Bedrock AgentCore
        agentProxyLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["bedrock-agentcore:InvokeAgentRuntime"],
            resources: ["*"],
        }));
        // Add Function URL for direct frontend access
        const agentProxyUrl = agentProxyLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
            cors: {
                allowedOrigins: [amplifyAppUrl, "http://localhost:3000"],
                allowedMethods: [lambda.HttpMethod.POST],
                allowedHeaders: ["Content-Type"],
            },
        });
        const kb = new generative_ai_cdk_constructs_1.bedrock.GraphKnowledgeBase(this, "JobKnowledgeBase", {
            description: "Knowledge base with jobs from multiple sources - contains all job listings updated daily",
            embeddingModel: generative_ai_cdk_constructs_1.bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
            instruction: "You are a job search assistant. Help users find relevant job opportunities by searching through job listings. Provide accurate information about job requirements, responsibilities, and company details. Focus on matching user queries with the most relevant job postings.",
        });
        // Skip Docker image build for faster deployment - use existing image
        const jobSearchAgentImage = new ecrAssets.DockerImageAsset(this, "JobSearchAgentImage", {
            directory: path.join(__dirname, "..", "JobSearchAgent"),
            platform: lambdaArchitecture === lambda.Architecture.ARM_64
                ? ecrAssets.Platform.LINUX_ARM64
                : ecrAssets.Platform.LINUX_AMD64,
        });
        new generative_ai_cdk_constructs_1.bedrock.S3DataSource(this, "JobDataSource", {
            bucket: JobsBucket,
            knowledgeBase: kb,
            chunkingStrategy: generative_ai_cdk_constructs_1.bedrock.ChunkingStrategy.fixedSize({
                maxTokens: 1500,
                overlapPercentage: 20, // 20% overlap between chunks for better context continuity
            }),
            contextEnrichment: bedrock_1.ContextEnrichment.foundationModel({
                enrichmentModel: generative_ai_cdk_constructs_1.bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
            }),
        });
        // SQS Queue for job notifications
        const jobNotificationQueue = new sqs.Queue(this, "JobNotificationQueue", {
            visibilityTimeout: cdk.Duration.minutes(16), // Must be greater than Lambda timeout (15 min)
        });
        // Batch Processor Lambda
        const batchProcessorLambda = new lambda.Function(this, "BatchProcessorLambda", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.lambda_handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", "batch-processor")),
            timeout: cdk.Duration.minutes(5),
            architecture: lambdaArchitecture,
            environment: {
                STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
                SQS_QUEUE_URL: jobNotificationQueue.queueUrl,
            },
        });
        // Grant permissions
        StudentProfileTable.grantReadData(batchProcessorLambda);
        JobRecommendationsTable.grantReadWriteData(batchProcessorLambda);
        jobNotificationQueue.grantSendMessages(batchProcessorLambda);
        // EventBridge rule to trigger at 1 AM daily
        const dailyJobProcessingRule = new events.Rule(this, "DailyJobProcessingRule", {
            schedule: events.Schedule.cron({ minute: "0", hour: "8" }),
            description: "Trigger batch processor at 1 AM MST daily",
        });
        dailyJobProcessingRule.addTarget(new targets.LambdaFunction(batchProcessorLambda));
        // SQS Processor Lambda to consume job notification messages
        const sqsProcessorLambda = new lambda.Function(this, "SQSProcessorLambda", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.lambda_handler",
            code: lambda.Code.fromDockerBuild(path.join(__dirname, "..", "lambda", "sqs-processor")),
            timeout: cdk.Duration.minutes(15),
            architecture: lambdaArchitecture,
            environment: {
                BEDROCK_AGENTCORE_RUNTIME_ARN: "MANUALLY ADD HERE", // One manual step to be done later
                BEDROCK_AGENTCORE_QUALIFIER: "DEFAULT",
            },
        });
        // Changed from 'bedrock:InvokeAgent' to 'bedrock-agentcore:InvokeAgentRuntime' for AgentCore compatibility
        sqsProcessorLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["bedrock-agentcore:InvokeAgentRuntime"],
            resources: ["*"],
        }));
        // Configure SQS as event source for the processor lambda
        sqsProcessorLambda.addEventSource(new aws_lambda_event_sources_1.SqsEventSource(jobNotificationQueue, {
            batchSize: 10,
        }));
        // Notification Sender Lambda for 9 AM daily notifications
        const notificationSenderLambda = new lambda.Function(this, "NotificationSenderLambda", {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: "index.lambda_handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda", "notification-sender")),
            timeout: cdk.Duration.minutes(5),
            architecture: lambdaArchitecture,
            environment: {
                STUDENT_PROFILE_TABLE_NAME: StudentProfileTable.tableName,
                JOB_RECOMMENDATIONS_TABLE_NAME: JobRecommendationsTable.tableName,
                SENDER_EMAIL: senderEmail,
                SMS_ORIGINATION_NUMBER: senderNumber,
                // The environment variable for amplify is addded after amplify is created
            },
        });
        notificationSenderLambda.node.addDependency(senderIdentity);
        // Grant permissions for notification sender
        StudentProfileTable.grantReadData(notificationSenderLambda);
        JobRecommendationsTable.grantReadWriteData(notificationSenderLambda);
        notificationSenderLambda.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["ses:SendEmail", "ses:SendRawEmail"],
            resources: ["*"],
        }));
        // Grant SMS Voice v2 permissions
        notificationSenderLambda.addToRolePolicy(new iam.PolicyStatement({
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
        }));
        // EventBridge rule to trigger notification sender at 9 AM daily
        const dailyNotificationRule = new events.Rule(this, "DailyNotificationRule", {
            schedule: events.Schedule.cron({ minute: "0", hour: "16" }),
            description: "Send daily notifications at 9 AM MST",
        });
        dailyNotificationRule.addTarget(new targets.LambdaFunction(notificationSenderLambda));
        // Create IAM role for Bedrock AgentCore execution
        const bedrockAgentCoreExecutionRole = new iam.Role(this, "BedrockAgentCoreExecutionRole", {
            roleName: "BedrockAgentCoreExecutionRole",
            assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
        });
        // Attach managed policies
        bedrockAgentCoreExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonBedrockFullAccess"));
        bedrockAgentCoreExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess_v2"));
        bedrockAgentCoreExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("BedrockAgentCoreFullAccess"));
        // Add full access policies for logs, ECR, X-Ray, and CloudWatch
        bedrockAgentCoreExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "logs:*",
                "ecr:*",
                "xray:*",
                "cloudwatch:*",
            ],
            resources: ["*"],
        }));
        // Create Cognito Identity Pool for unauthenticated (guest) access
        const identityPool = new cognito.CfnIdentityPool(this, "JobSearchIdentityPool", {
            identityPoolName: `jobsearch-identity-pool-${timestamp}`,
            allowUnauthenticatedIdentities: true,
        });
        // Create IAM role for unauthenticated users with minimal permissions
        const unauthenticatedRole = new iam.Role(this, "UnauthenticatedRole", {
            assumedBy: new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": identityPool.ref,
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "unauthenticated",
                },
            }, "sts:AssumeRoleWithWebIdentity"),
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
        const mainBranch = amplifyApp.addBranch("main", {
            autoBuild: true,
            stage: "PRODUCTION",
        });
        // Add AMPLIFY_APP_URL to notification sender Lambda using the branch-specific URL
        notificationSenderLambda.addEnvironment('AMPLIFY_APP_URL', amplifyAppUrl);
        githubToken_secret_manager.grantRead(amplifyApp);
        new custom_resources_1.AwsCustomResource(this, "TriggerAmplifyBuild", {
            onCreate: {
                service: "Amplify",
                action: "startJob",
                parameters: {
                    appId: amplifyApp.appId,
                    branchName: mainBranch.branchName, // e.g. "main"
                    jobType: "RELEASE", // or REBUILD / RETRY / etc.
                },
                // ensure a new physical ID on every deploy so it actually runs each time
                physicalResourceId: custom_resources_1.PhysicalResourceId.of(`${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`),
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
                physicalResourceId: custom_resources_1.PhysicalResourceId.of(`${amplifyApp.appId}-${mainBranch.branchName}-${Date.now()}`),
            },
            policy: custom_resources_1.AwsCustomResourcePolicy.fromSdkCalls({
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
            description: "Knowledge Base ID for job search (passed as build arg to Docker)",
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
exports.jobsearch1 = jobsearch1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2tlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsK0RBQWlEO0FBQ2pELG1GQUFzRTtBQUN0RSxzRUFBd0Q7QUFDeEQseURBQTJDO0FBQzNDLHVDQUF5QjtBQUN6Qix1REFBeUM7QUFDekMsd0VBQTBEO0FBQzFELHdGQUEyRTtBQUMzRSx1RkFBOEY7QUFDOUYsMkNBQTZCO0FBQzdCLG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQsd0VBQTBEO0FBQzFELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsK0VBQWlFO0FBQ2pFLG9FQUFzRDtBQUN0RCx1RUFBeUQ7QUFDekQsbUVBQStHO0FBQy9HLGlFQUFtRDtBQUVuRCxNQUFhLFVBQVcsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVEQUF1RDtRQUN2RCxzQ0FBc0M7UUFDdEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDM0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDM0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDekQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLENBQUM7UUFHN0QsSUFBSSxD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V0FBVyxFQUFFLDZDQUE2QztZQUMxRCxVQUFVLEVBQUUscUJBQXFCO1NBQ2xDLENBQUMsQ0FBQztRQUVILGtDQUFrQztRQUNsQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxZQUFZLENBQUMsR0FBRztZQUN2QixXQUFXLEVBQUUsd0ZBQXdGO1lBQ3JHLFVBQVUsRUFBRSx1QkFBdUI7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsc0JBQXNCO1FBQ3RCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0NBQWtDLEVBQUU7WUFDMUQsS0FBSyxFQUFFLDZCQUE2QixDQUFDLE9BQU87WUFDNUMsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxVQUFVLEVBQUUsa0NBQWtDO1NBQy9DLENBQUMsQ0FBQztRQUVILDJDQUEyQztRQUMzQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsYUFBYTtZQUNwQixXQUFXLEVBQUUscUVBQXFFO1lBQ2xGLFVBQVUsRUFBRSxlQUFlO1NBQzVCLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXR5QkQsZ0NBc3lCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcbmltcG9ydCB7IFNxc0V2ZW50U291cmNlIH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlc1wiO1xuaW1wb3J0ICogYXMgZWNyQXNzZXRzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWNyLWFzc2V0c1wiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBvcyBmcm9tIFwib3NcIjtcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcbmltcG9ydCAqIGFzIHMzZGVwbG95IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1kZXBsb3ltZW50JztcbmltcG9ydCB7IGJlZHJvY2sgYXMgYmVkcm9jayB9IGZyb20gXCJAY2RrbGFicy9nZW5lcmF0aXZlLWFpLWNkay1jb25zdHJ1Y3RzXCI7XG5pbXBvcnQgeyBDb250ZXh0RW5yaWNobWVudCB9IGZyb20gXCJAY2RrbGFicy9nZW5lcmF0aXZlLWFpLWNkay1jb25zdHJ1Y3RzL2xpYi9jZGstbGliL2JlZHJvY2tcIjtcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGJcIjtcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWV2ZW50c1wiO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzXCI7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zcXNcIjtcbmltcG9ydCAqIGFzIHNlcyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNlc1wiO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlclwiO1xuaW1wb3J0ICogYXMgYW1wbGlmeSBmcm9tIFwiQGF3cy1jZGsvYXdzLWFtcGxpZnktYWxwaGFcIjtcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgeyBBd3NDdXN0b21SZXNvdXJjZSwgQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3ksIFBoeXNpY2FsUmVzb3VyY2VJZCwgfSBmcm9tIFwiYXdzLWNkay1saWIvY3VzdG9tLXJlc291cmNlc1wiO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIjtcblxuZXhwb3J0IGNsYXNzIGpvYnNlYXJjaDEgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBiYXNpYyBpbmZvcm1hdGlvbiByZXRyaWV2YWwgYmVmb3JlIHdyaXRpbmcgcmVzb3VyY2VzXG4gICAgLy8gQWRtaW4gZW1haWwgZm9yIFNFUyBzZW5kZXIgaWRlbnRpdHlcbiAgICBjb25zdCBzZW5kZXJFbWFpbCA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KFwic2VuZGVyRW1haWxcIik7XG4gICAgY29uc3QgZ2l0aHViVG9rZW4gPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImdpdGh1YlRva2VuXCIpO1xuICAgIGNvbnN0IGdpdGh1Yk93bmVyID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoXCJnaXRodWJPd25lclwiKTtcbiAgICBjb25zdCBnaXRodWJSZXBvID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoXCJnaXRodWJSZXBvXCIpO1xuICAgIGNvbnN0IHNlbmRlck51bWJlciA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KFwic2VuZGVyTnVtYmVyXCIpO1xuXG5cbiAgICBpZiAoIXNlbmRlckVtYWlsIHx8ICFnaXRodWJUb2tlbiB8fCAhZ2l0aHViT3duZXIgfHwgIWdpdGh1YlJlcG8gfHwgIXNlbmRlck51bWJlcilcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJNaXNzaW5nIHJlcXVpcmVkIGNvbnRleHQgdmFyaWFibGUocyk6IHNlbmRlckVtYWlsLCBnaXRodWJUb2tlbiwgZ2l0aHViT3duZXIsIGdpdGh1YlJlcG8sIGFuZC9vciBzZW5kZXJOdW1iZXIuIFBsZWFzZSBwcm92aWRlIGFsbCBpbiBDREsgY29udGV4dCAoZS5nLiwgY2RrIGRlcGxveSAtYyBzZW5kZXJFbWFpbD15b3VyQGVtYWlsLmNvbSAtYyBnaXRodWJUb2tlbj15b3VyX2dpdGh1Yl90b2tlbiAtYyBnaXRodWJPd25lcj15b3VyX2dpdGh1Yl9vd25lciAtYyBnaXRodWJSZXBvPXlvdXJfZ2l0aHViX3JlcG8gLWMgc2VuZGVyTnVtYmVyPSsxMjM0NTY3ODkwKVwiXG4gICAgICApO1xuXG4gICAgY29uc3QgYXdzX3JlZ2lvbiA9IGNkay5TdGFjay5vZih0aGlzKS5yZWdpb247XG4gICAgY29uc29sZS5sb2coYEFXUyBSZWdpb246ICR7YXdzX3JlZ2lvbn1gKTtcblxuICAgIGNvbnN0IGhvc3RBcmNoaXRlY3R1cmUgPSBvcy5hcmNoKCk7XG4gICAgY29uc29sZS5sb2coYEhvc3QgYXJjaGl0ZWN0dXJlOiAke2hvc3RBcmNoaXRlY3R1cmV9YCk7XG5cbiAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgY29uc3QgbGFtYmRhQXJjaGl0ZWN0dXJlID1cbiAgICAgIGhvc3RBcmNoaXRlY3R1cmUgPT09IFwiYXJtNjRcIlxuICAgICAgICA/IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0XG4gICAgICAgIDogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjQ7XG4gICAgY29uc29sZS5sb2coYExhbWJkYSBhcmNoaXRlY3R1cmU6ICR7bGFtYmRhQXJjaGl0ZWN0dXJlfWApO1xuXG4gICAgY29uc3QgZ2l0aHViVG9rZW5fc2VjcmV0X21hbmFnZXIgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KFxuICAgICAgdGhpcyxcbiAgICAgIFwiR2l0SHViVG9rZW5cIixcbiAgICAgIHtcbiAgICAgICAgc2VjcmV0TmFtZTogXCJnaXRodWItc2VjcmV0LXRva2VuXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkdpdEh1YiBQZXJzb25hbCBBY2Nlc3MgVG9rZW4gZm9yIEFtcGxpZnlcIixcbiAgICAgICAgc2VjcmV0U3RyaW5nVmFsdWU6IGNkay5TZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQoZ2l0aHViVG9rZW4pLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgQW1wbGlmeSBhcHAgZWFybHkgZm9yIENPUlMgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IGFtcGxpZnlBcHAgPSBuZXcgYW1wbGlmeS5BcHAodGhpcywgXCJBbXBsaWZ5RnJvbnRlbmRVSVwiLCB7XG4gICAgICBzb3VyY2VDb2RlUHJvdmlkZXI6IG5ldyBhbXBsaWZ5LkdpdEh1YlNvdXJjZUNvZGVQcm92aWRlcih7XG4gICAgICAgIG93bmVyOiBnaXRodWJPd25lcixcbiAgICAgICAgcmVwb3NpdG9yeTogZ2l0aHViUmVwbyxcbiAgICAgICAgb2F1dGhUb2tlbjogZ2l0aHViVG9rZW5fc2VjcmV0X21hbmFnZXIuc2VjcmV0VmFsdWUsXG4gICAgICB9KSxcbiAgICAgIGJ1aWxkU3BlYzogY2RrLmF3c19jb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3RUb1lhbWwoe1xuICAgICAgICB2ZXJzaW9uOiBcIjEuMFwiLFxuICAgICAgICBmcm9udGVuZDoge1xuICAgICAgICAgIHBoYXNlczoge1xuICAgICAgICAgICAgcHJlQnVpbGQ6IHtcbiAgICAgICAgICAgICAgY29tbWFuZHM6IFtcImNkIGZyb250ZW5kXCIsIFwibnBtIGNpXCJdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgIGNvbW1hbmRzOiBbXCJucG0gcnVuIGJ1aWxkXCJdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgICAgYmFzZURpcmVjdG9yeTogXCJmcm9udGVuZC9idWlsZFwiLFxuICAgICAgICAgICAgZmlsZXM6IFtcIioqLypcIl0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjYWNoZToge1xuICAgICAgICAgICAgcGF0aHM6IFtcImZyb250ZW5kL25vZGVfbW9kdWxlcy8qKi8qXCJdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGN1c3RvbVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2U6XG4gICAgICAgICAgICBcIjwvXlteLl0rJHxcXFxcLig/IShjc3N8Z2lmfGljb3xqcGd8anN8cG5nfHR4dHxzdmd8d29mZnx3b2ZmMnx0dGZ8bWFwfGpzb24pJCkoW14uXSskKS8+XCIsXG4gICAgICAgICAgdGFyZ2V0OiBcIi9pbmRleC5odG1sXCIsXG4gICAgICAgICAgc3RhdHVzOiBhbXBsaWZ5LlJlZGlyZWN0U3RhdHVzLlJFV1JJVEUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2U6IFwiL2pvYi1vcHRpb25zXCIsXG4gICAgICAgICAgdGFyZ2V0OiBcIi9pbmRleC5odG1sXCIsXG4gICAgICAgICAgc3RhdHVzOiBhbXBsaWZ5LlJlZGlyZWN0U3RhdHVzLlJFV1JJVEUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzb3VyY2U6IFwiL2NoYXRib3RcIixcbiAgICAgICAgICB0YXJnZXQ6IFwiL2luZGV4Lmh0bWxcIixcbiAgICAgICAgICBzdGF0dXM6IGFtcGxpZnkuUmVkaXJlY3RTdGF0dXMuUkVXUklURSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHNvdXJjZTogXCIvdW5zdWJzY3JpYmVcIixcbiAgICAgICAgICB0YXJnZXQ6IFwiL2luZGV4Lmh0bWxcIixcbiAgICAgICAgICBzdGF0dXM6IGFtcGxpZnkuUmVkaXJlY3RTdGF0dXMuUkVXUklURSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQW1wbGlmeSBhcHAgVVJMIGNvbnN0YW50IGZvciBDT1JTXG4gICAgY29uc3QgYW1wbGlmeUFwcFVybCA9IGFtcGxpZnlBcHAuYXBwSWRcbiAgICAgID8gYGh0dHBzOi8vbWFpbi4ke2FtcGxpZnlBcHAuYXBwSWR9LmFtcGxpZnlhcHAuY29tYFxuICAgICAgOiBcIipcIjtcbiAgICBjb25zb2xlLmxvZyhgRnJvbnRlbmQgVVJMIGZvciBDT1JTOiAke2FtcGxpZnlBcHBVcmx9YCk7XG5cbiAgICAvLyBDcmVhdGUgU0VTIEVtYWlsIElkZW50aXR5XG4gICAgY29uc3Qgc2VuZGVySWRlbnRpdHkgPSBuZXcgc2VzLkVtYWlsSWRlbnRpdHkodGhpcywgXCJTZW5kZXJJZGVudGl0eVwiLCB7XG4gICAgICBpZGVudGl0eTogc2VzLklkZW50aXR5LmVtYWlsKHNlbmRlckVtYWlsKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IEpvYnNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiSm9ic0J1Y2tldFwiLCB7XG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgIH0pO1xuXG4gICAgY29uc3QgUmVzdW1lQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlJlc3VtZUJ1Y2tldFwiLCB7XG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFtcIipcIl0sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkhFQUQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFthbXBsaWZ5QXBwVXJsLCBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiXSxcbiAgICAgICAgICBleHBvc2VkSGVhZGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2FycmllclJlc291cmNlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJjYXJyaWVyUmVzb3VyY2VzQnVja2V0XCIsIHtcbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogbmV3IHMzLkJsb2NrUHVibGljQWNjZXNzKHtcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiB0cnVlLFxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiB0cnVlLFxuICAgICAgICBibG9ja1B1YmxpY1BvbGljeTogZmFsc2UsIC8vIEFsbG93IGJ1Y2tldCBwb2xpY2llc1xuICAgICAgICByZXN0cmljdFB1YmxpY0J1Y2tldHM6IGZhbHNlLCAvLyBBbGxvdyBwdWJsaWMgYnVja2V0IHBvbGljaWVzXG4gICAgICB9KSxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbXCIqXCJdLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5IRUFELFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUFVULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUE9TVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkRFTEVURSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbYW1wbGlmeUFwcFVybCwgXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIl0sXG4gICAgICAgICAgZXhwb3NlZEhlYWRlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBwbGFjZWhvbGRlciBmaWxlcyB0byBlc3RhYmxpc2ggZm9sZGVyIHN0cnVjdHVyZVxuICAgIGNvbnN0IHByZWZpeGVzID0gWydwdWJsaWMvJywgJ3ByaXZhdGUvJ107XG5cbiAgICBwcmVmaXhlcy5mb3JFYWNoKHByZWZpeCA9PiB7XG4gICAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCBgRGVwbG95JHtwcmVmaXgucmVwbGFjZSgnLycsICcnKX1gLCB7XG4gICAgICAgIHNvdXJjZXM6IFtzM2RlcGxveS5Tb3VyY2UuZGF0YShcIiBcIiwgYCR7cHJlZml4LnJlcGxhY2UoJy8nLCAnJyl9LnBsYWNlaG9sZGVyYCldLFxuICAgICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogY2FycmllclJlc291cmNlc0J1Y2tldCxcbiAgICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6IHByZWZpeCxcbiAgICAgIH0pXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgYnVja2V0IHBvbGljeSB0byBhbGxvdyBwdWJsaWMgcmVhZCBhY2Nlc3MgdG8gcHVibGljLyBmb2xkZXJcbiAgICBjYXJyaWVyUmVzb3VyY2VzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgICAgICBhY3Rpb25zOiBbXCJzMzpHZXRPYmplY3RcIl0sXG4gICAgICAgIHJlc291cmNlczogW2Ake2NhcnJpZXJSZXNvdXJjZXNCdWNrZXQuYnVja2V0QXJufS9wdWJsaWMvKmBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3QgU3R1ZGVudFByb2ZpbGVUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShcbiAgICAgIHRoaXMsXG4gICAgICBcIlN0dWRlbnRQcm9maWxlVGFibGVcIixcbiAgICAgIHtcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwiYWN0aW9uSURcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy9mb3IgcHJvZHVjdGlvbiBoYXZlIHJldGFpblxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBKb2IgUmVjb21tZW5kYXRpb25zIFRhYmxlXG4gICAgLy8gUHJpbWFyeSBrZXk6IGVtYWlsI2pvYl90eXBlIChlLmcuLCBcImpvaG5AZ21haWwuY29tI3NvZnR3YXJlLWVuZ2luZWVyXCIpXG4gICAgY29uc3QgSm9iUmVjb21tZW5kYXRpb25zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoXG4gICAgICB0aGlzLFxuICAgICAgXCJKb2JSZWNvbW1lbmRhdGlvbnNUYWJsZVwiLFxuICAgICAge1xuICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICBuYW1lOiBcInVzZXJKb2JLZXlcIixcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgICAgfSxcbiAgICAgICAgc29ydEtleToge1xuICAgICAgICAgIG5hbWU6IFwiY3JlYXRlZEF0XCIsXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgIH0sXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIGZvciBwcm9kdWN0aW9uIGhhdmUgcmV0YWluXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAvLyBBUEkgR2F0ZXdheSB3aXRoIGRpcmVjdCBEeW5hbW9EQiBpbnRlZ3JhdGlvbiBmb3Igam9iIHJlY29tbWVuZGF0aW9uc1xuICAgIGNvbnN0IGpvYlJlY29tbWVuZGF0aW9uc0FwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0pvYlJlY29tbWVuZGF0aW9uc0FwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnam9iLXJlY29tbWVuZGF0aW9ucy1hcGknLFxuICAgICAgZGVzY3JpcHRpb246ICdEaXJlY3QgQVBJIGZvciByZXRyaWV2aW5nIGpvYiByZWNvbW1lbmRhdGlvbnMgZnJvbSBTTVMgbGlua3MnLFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLk9GRiwgLy8gRGlzYWJsZSBsb2dnaW5nIHRvIGF2b2lkIENsb3VkV2F0Y2ggcm9sZSByZXF1aXJlbWVudFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIEFQSSBHYXRld2F5IHRvIGFjY2VzcyBEeW5hbW9EQlxuICAgIGNvbnN0IGFwaUdhdGV3YXlEeW5hbW9EQlJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FwaUdhdGV3YXlEeW5hbW9EQlJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJyksXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCB0aGUgcm9sZSBwZXJtaXNzaW9uIHRvIHJlYWQgZnJvbSBKb2JSZWNvbW1lbmRhdGlvbnNUYWJsZVxuICAgIEpvYlJlY29tbWVuZGF0aW9uc1RhYmxlLmdyYW50UmVhZERhdGEoYXBpR2F0ZXdheUR5bmFtb0RCUm9sZSk7XG5cbiAgICAvLyBDcmVhdGUgcmVzb3VyY2UgcGF0aDogL2pvYi1yZWNvbW1lbmRhdGlvbnMve3VzZXJKb2JLZXl9L3tjcmVhdGVkQXR9XG4gICAgY29uc3Qgam9iUmVjb21tZW5kYXRpb25zUmVzb3VyY2UgPSBqb2JSZWNvbW1lbmRhdGlvbnNBcGkucm9vdC5hZGRSZXNvdXJjZSgnam9iLXJlY29tbWVuZGF0aW9ucycpO1xuICAgIGNvbnN0IHVzZXJKb2JLZXlSZXNvdXJjZSA9IGpvYlJlY29tbWVuZGF0aW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7dXNlckpvYktleX0nKTtcbiAgICBjb25zdCBjcmVhdGVkQXRSZXNvdXJjZSA9IHVzZXJKb2JLZXlSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2NyZWF0ZWRBdH0nKTtcblxuICAgIC8vIEFkZCBHRVQgbWV0aG9kIHdpdGggZGlyZWN0IER5bmFtb0RCIGludGVncmF0aW9uXG4gICAgY3JlYXRlZEF0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5Bd3NJbnRlZ3JhdGlvbih7XG4gICAgICBzZXJ2aWNlOiAnZHluYW1vZGInLFxuICAgICAgYWN0aW9uOiAnUXVlcnknLFxuICAgICAgb3B0aW9uczoge1xuICAgICAgICBjcmVkZW50aWFsc1JvbGU6IGFwaUdhdGV3YXlEeW5hbW9EQlJvbGUsXG4gICAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGB7XG4gICAgICAgICAgICBcIlRhYmxlTmFtZVwiOiBcIiR7Sm9iUmVjb21tZW5kYXRpb25zVGFibGUudGFibGVOYW1lfVwiLFxuICAgICAgICAgICAgXCJLZXlDb25kaXRpb25FeHByZXNzaW9uXCI6IFwidXNlckpvYktleSA9IDp1c2VySm9iS2V5XCIsXG4gICAgICAgICAgICBcIkV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXNcIjoge1xuICAgICAgICAgICAgICBcIjp1c2VySm9iS2V5XCI6IHtcbiAgICAgICAgICAgICAgICBcIlNcIjogXCIkdXRpbC51cmxEZWNvZGUoJGlucHV0LnBhcmFtcygndXNlckpvYktleScpKVwiXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIlNjYW5JbmRleEZvcndhcmRcIjogZmFsc2UsXG4gICAgICAgICAgICBcIkxpbWl0XCI6IDFcbiAgICAgICAgICB9YFxuICAgICAgICB9LFxuICAgICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW3tcbiAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCIsXG4gICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXG4gICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULE9QVElPTlMnXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJlc3BvbnNlVGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IGB7XG4gICAgICAgICAgICAgIFwidXNlckpvYktleVwiOiBcIiRpbnB1dC5wYXRoKCckLkl0ZW1zWzBdLnVzZXJKb2JLZXkuUycpXCIsXG4gICAgICAgICAgICAgIFwiY3JlYXRlZEF0XCI6IFwiJGlucHV0LnBhdGgoJyQuSXRlbXNbMF0uY3JlYXRlZEF0LlMnKVwiLFxuICAgICAgICAgICAgICBcImVtYWlsXCI6IFwiJGlucHV0LnBhdGgoJyQuSXRlbXNbMF0uZW1haWwuUycpXCIsXG4gICAgICAgICAgICAgIFwiam9iQ2F0ZWdvcnlcIjogXCIkaW5wdXQucGF0aCgnJC5JdGVtc1swXS5qb2JDYXRlZ29yeS5TJylcIixcbiAgICAgICAgICAgICAgXCJqb2JJbmZvcm1hdGlvblwiOiAkaW5wdXQuanNvbignJC5JdGVtc1swXS5qb2JJbmZvcm1hdGlvbicpXG4gICAgICAgICAgICB9YFxuICAgICAgICAgIH1cbiAgICAgICAgfSwge1xuICAgICAgICAgIHN0YXR1c0NvZGU6ICc0MDQnLFxuICAgICAgICAgIHNlbGVjdGlvblBhdHRlcm46ICcuKlwiX190eXBlXCI6XCJjb20uYW1hem9uLmNvcmFsLnZhbGlkYXRlI1ZhbGlkYXRpb25FeGNlcHRpb25cIi4qJyxcbiAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCIsXG4gICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXG4gICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULE9QVElPTlMnXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJlc3BvbnNlVGVtcGxhdGVzOiB7XG4gICAgICAgICAgICAnYXBwbGljYXRpb24vanNvbic6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6ICdKb2IgcmVjb21tZW5kYXRpb24gbm90IGZvdW5kJyxcbiAgICAgICAgICAgICAgdXNlckpvYktleTogJycsXG4gICAgICAgICAgICAgIGNyZWF0ZWRBdDogJycsXG4gICAgICAgICAgICAgIGVtYWlsOiAnJyxcbiAgICAgICAgICAgICAgam9iQ2F0ZWdvcnk6ICcnLFxuICAgICAgICAgICAgICBqb2JJbmZvcm1hdGlvbjogW11cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XVxuICAgICAgfVxuICAgIH0pLCB7XG4gICAgICBtZXRob2RSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxuICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWVcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiAnNDA0JyxcbiAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfSk7XG5cbiAgICBjb25zdCBzYXZlUHJvZmlsZSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJzYXZlUHJvZmlsZVwiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXgubGFtYmRhX2hhbmRsZXJcIixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxuICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uXCIsIFwibGFtYmRhXCIsIFwic2F2ZS1wcm9maWxlXCIpXG4gICAgICApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RVREVOVF9QUk9GSUxFX1RBQkxFX05BTUU6IFN0dWRlbnRQcm9maWxlVGFibGUudGFibGVOYW1lLFxuICAgICAgfSxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhQXJjaGl0ZWN0dXJlLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEZ1bmN0aW9uIFVSTCBmb3IgZGlyZWN0IGZyb250ZW5kIGFjY2Vzc1xuICAgIGNvbnN0IHNhdmVQcm9maWxlVXJsID0gc2F2ZVByb2ZpbGUuYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLk5PTkUsXG4gICAgICBjb3JzOiB7XG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbYW1wbGlmeUFwcFVybCwgXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIl0sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuUE9TVCwgbGFtYmRhLkh0dHBNZXRob2QuR0VUXSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFtcIkNvbnRlbnQtVHlwZVwiXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gd2l0aCBTMyBidWNrZXQgbmFtZSBmcm9tIGVudmlyb25tZW50IHZhcmlhYmxlIChSZXN1bWVCdWNrZXQpXG4gICAgY29uc3QgcmVzdW1lUHJvY2Vzc29yTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICBcIlJlc3VtZVByb2Nlc3NvckxhbWJkYVwiLFxuICAgICAge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMixcbiAgICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcImxhbWJkYVwiLCBcInJlc3VtZS1wYXJzZXJcIilcbiAgICAgICAgKSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBSRVNVTUVfQlVDS0VUOiBSZXN1bWVCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBTQVZFX1BST0ZJTEVfRlVOQ1RJT05fTkFNRTogc2F2ZVByb2ZpbGUuZnVuY3Rpb25OYW1lLFxuICAgICAgICB9LFxuICAgICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYUFyY2hpdGVjdHVyZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQWRkIEZ1bmN0aW9uIFVSTCBmb3IgZGlyZWN0IGZyb250ZW5kIGFjY2VzcyB0byByZXN1bWUgcGFyc2VyXG4gICAgY29uc3QgcmVzdW1lUHJvY2Vzc29yVXJsID0gcmVzdW1lUHJvY2Vzc29yTGFtYmRhLmFkZEZ1bmN0aW9uVXJsKHtcbiAgICAgIGF1dGhUeXBlOiBsYW1iZGEuRnVuY3Rpb25VcmxBdXRoVHlwZS5OT05FLFxuICAgICAgY29yczoge1xuICAgICAgICBhbGxvd2VkT3JpZ2luczogW2FtcGxpZnlBcHBVcmwsIFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCJdLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogW2xhbWJkYS5IdHRwTWV0aG9kLlBPU1RdLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogW1wiQ29udGVudC1UeXBlXCJdLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9ucyB0byBhY2Nlc3MgdGhlIFJlc3VtZUJ1Y2tldFxuICAgIFJlc3VtZUJ1Y2tldC5ncmFudFJlYWQocmVzdW1lUHJvY2Vzc29yTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9ucyB0byBpbnZva2UgQmVkcm9jayBtb2RlbHNcbiAgICByZXN1bWVQcm9jZXNzb3JMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcImJlZHJvY2s6SW52b2tlTW9kZWxcIl0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSwgLy8gWW91IGNhbiByZXN0cmljdCB0byBzcGVjaWZpYyBtb2RlbCBBUk5zIGlmIG5lZWRlZFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgcmVzdW1lIHBhcnNlciBwZXJtaXNzaW9uIHRvIGludm9rZSBzYXZlIHByb2ZpbGUgTGFtYmRhXG4gICAgc2F2ZVByb2ZpbGUuZ3JhbnRJbnZva2UocmVzdW1lUHJvY2Vzc29yTGFtYmRhKTtcblxuICAgIC8vIEdyYW50IHNhdmUtcHJvZmlsZSBMYW1iZGEgcGVybWlzc2lvbnMgdG8gd3JpdGUgdG8gRHluYW1vREJcbiAgICBTdHVkZW50UHJvZmlsZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzYXZlUHJvZmlsZSk7XG5cbiAgICAvLyBBZ2VudCBQcm94eSBMYW1iZGEgLSBIYW5kbGVzIGFnZW50IGludm9jYXRpb25zIHZpYSBIVFRQXG4gICAgY29uc3QgYWdlbnRQcm94eUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJBZ2VudFByb3h5TGFtYmRhXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcImxhbWJkYVwiLCBcImFnZW50LXByb3h5XCIpXG4gICAgICApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQUdFTlRfUlVOVElNRV9BUk46IFwiXCIsXG4gICAgICAgIEFHRU5UX1FVQUxJRklFUjogXCJERUZBVUxUXCIsXG4gICAgICB9LFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGFBcmNoaXRlY3R1cmUsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBBZ2VudCBQcm94eSBMYW1iZGEgcGVybWlzc2lvbiB0byBpbnZva2UgQmVkcm9jayBBZ2VudENvcmVcbiAgICBhZ2VudFByb3h5TGFtYmRhLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJiZWRyb2NrLWFnZW50Y29yZTpJbnZva2VBZ2VudFJ1bnRpbWVcIl0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBGdW5jdGlvbiBVUkwgZm9yIGRpcmVjdCBmcm9udGVuZCBhY2Nlc3NcbiAgICBjb25zdCBhZ2VudFByb3h5VXJsID0gYWdlbnRQcm94eUxhbWJkYS5hZGRGdW5jdGlvblVybCh7XG4gICAgICBhdXRoVHlwZTogbGFtYmRhLkZ1bmN0aW9uVXJsQXV0aFR5cGUuTk9ORSxcbiAgICAgIGludm9rZU1vZGU6IGxhbWJkYS5JbnZva2VNb2RlLlJFU1BPTlNFX1NUUkVBTSxcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFthbXBsaWZ5QXBwVXJsLCBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtsYW1iZGEuSHR0cE1ldGhvZC5QT1NUXSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFtcIkNvbnRlbnQtVHlwZVwiXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBrYiA9IG5ldyBiZWRyb2NrLkdyYXBoS25vd2xlZGdlQmFzZSh0aGlzLCBcIkpvYktub3dsZWRnZUJhc2VcIiwge1xuICAgICAgZGVzY3JpcHRpb246IFwiS25vd2xlZGdlIGJhc2Ugd2l0aCBqb2JzIGZyb20gbXVsdGlwbGUgc291cmNlcyAtIGNvbnRhaW5zIGFsbCBqb2IgbGlzdGluZ3MgdXBkYXRlZCBkYWlseVwiLFxuICAgICAgZW1iZWRkaW5nTW9kZWw6IGJlZHJvY2suQmVkcm9ja0ZvdW5kYXRpb25Nb2RlbC5USVRBTl9FTUJFRF9URVhUX1YyXzEwMjQsXG4gICAgICBpbnN0cnVjdGlvbjogXCJZb3UgYXJlIGEgam9iIHNlYXJjaCBhc3Npc3RhbnQuIEhlbHAgdXNlcnMgZmluZCByZWxldmFudCBqb2Igb3Bwb3J0dW5pdGllcyBieSBzZWFyY2hpbmcgdGhyb3VnaCBqb2IgbGlzdGluZ3MuIFByb3ZpZGUgYWNjdXJhdGUgaW5mb3JtYXRpb24gYWJvdXQgam9iIHJlcXVpcmVtZW50cywgcmVzcG9uc2liaWxpdGllcywgYW5kIGNvbXBhbnkgZGV0YWlscy4gRm9jdXMgb24gbWF0Y2hpbmcgdXNlciBxdWVyaWVzIHdpdGggdGhlIG1vc3QgcmVsZXZhbnQgam9iIHBvc3RpbmdzLlwiLFxuICAgIH0pO1xuXG4gICAgLy8gU2tpcCBEb2NrZXIgaW1hZ2UgYnVpbGQgZm9yIGZhc3RlciBkZXBsb3ltZW50IC0gdXNlIGV4aXN0aW5nIGltYWdlXG4gICAgY29uc3Qgam9iU2VhcmNoQWdlbnRJbWFnZSA9IG5ldyBlY3JBc3NldHMuRG9ja2VySW1hZ2VBc3NldChcbiAgICAgIHRoaXMsXG4gICAgICBcIkpvYlNlYXJjaEFnZW50SW1hZ2VcIixcbiAgICAgIHtcbiAgICAgICAgZGlyZWN0b3J5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uXCIsIFwiSm9iU2VhcmNoQWdlbnRcIiksXG4gICAgICAgIHBsYXRmb3JtOlxuICAgICAgICAgIGxhbWJkYUFyY2hpdGVjdHVyZSA9PT0gbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjRcbiAgICAgICAgICAgID8gZWNyQXNzZXRzLlBsYXRmb3JtLkxJTlVYX0FSTTY0XG4gICAgICAgICAgICA6IGVjckFzc2V0cy5QbGF0Zm9ybS5MSU5VWF9BTUQ2NCxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgbmV3IGJlZHJvY2suUzNEYXRhU291cmNlKHRoaXMsIFwiSm9iRGF0YVNvdXJjZVwiLCB7XG4gICAgICBidWNrZXQ6IEpvYnNCdWNrZXQsXG4gICAgICBrbm93bGVkZ2VCYXNlOiBrYixcbiAgICAgIGNodW5raW5nU3RyYXRlZ3k6IGJlZHJvY2suQ2h1bmtpbmdTdHJhdGVneS5maXhlZFNpemUoe1xuICAgICAgICBtYXhUb2tlbnM6IDE1MDAsXG4gICAgICAgIG92ZXJsYXBQZXJjZW50YWdlOiAyMCwgLy8gMjAlIG92ZXJsYXAgYmV0d2VlbiBjaHVua3MgZm9yIGJldHRlciBjb250ZXh0IGNvbnRpbnVpdHlcbiAgICAgIH0pLFxuICAgICAgY29udGV4dEVucmljaG1lbnQ6IENvbnRleHRFbnJpY2htZW50LmZvdW5kYXRpb25Nb2RlbCh7XG4gICAgICAgIGVucmljaG1lbnRNb2RlbDpcbiAgICAgICAgICBiZWRyb2NrLkJlZHJvY2tGb3VuZGF0aW9uTW9kZWwuQU5USFJPUElDX0NMQVVERV9IQUlLVV9WMV8wLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBTUVMgUXVldWUgZm9yIGpvYiBub3RpZmljYXRpb25zXG4gICAgY29uc3Qgam9iTm90aWZpY2F0aW9uUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsIFwiSm9iTm90aWZpY2F0aW9uUXVldWVcIiwge1xuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE2KSwgLy8gTXVzdCBiZSBncmVhdGVyIHRoYW4gTGFtYmRhIHRpbWVvdXQgKDE1IG1pbilcbiAgICB9KTtcblxuICAgIC8vIEJhdGNoIFByb2Nlc3NvciBMYW1iZGFcbiAgICBjb25zdCBiYXRjaFByb2Nlc3NvckxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgXCJCYXRjaFByb2Nlc3NvckxhbWJkYVwiLFxuICAgICAge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcbiAgICAgICAgaGFuZGxlcjogXCJpbmRleC5sYW1iZGFfaGFuZGxlclwiLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXG4gICAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcImxhbWJkYVwiLCBcImJhdGNoLXByb2Nlc3NvclwiKVxuICAgICAgICApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGFBcmNoaXRlY3R1cmUsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgU1RVREVOVF9QUk9GSUxFX1RBQkxFX05BTUU6IFN0dWRlbnRQcm9maWxlVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIFNRU19RVUVVRV9VUkw6IGpvYk5vdGlmaWNhdGlvblF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uc1xuICAgIFN0dWRlbnRQcm9maWxlVGFibGUuZ3JhbnRSZWFkRGF0YShiYXRjaFByb2Nlc3NvckxhbWJkYSk7XG4gICAgSm9iUmVjb21tZW5kYXRpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGJhdGNoUHJvY2Vzc29yTGFtYmRhKTtcbiAgICBqb2JOb3RpZmljYXRpb25RdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyhiYXRjaFByb2Nlc3NvckxhbWJkYSk7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBydWxlIHRvIHRyaWdnZXIgYXQgMSBBTSBkYWlseVxuICAgIGNvbnN0IGRhaWx5Sm9iUHJvY2Vzc2luZ1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUoXG4gICAgICB0aGlzLFxuICAgICAgXCJEYWlseUpvYlByb2Nlc3NpbmdSdWxlXCIsXG4gICAgICB7XG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7IG1pbnV0ZTogXCIwXCIsIGhvdXI6IFwiOFwiIH0pLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJUcmlnZ2VyIGJhdGNoIHByb2Nlc3NvciBhdCAxIEFNIE1TVCBkYWlseVwiLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBkYWlseUpvYlByb2Nlc3NpbmdSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGJhdGNoUHJvY2Vzc29yTGFtYmRhKVxuICAgICk7XG5cbiAgICAvLyBTUVMgUHJvY2Vzc29yIExhbWJkYSB0byBjb25zdW1lIGpvYiBub3RpZmljYXRpb24gbWVzc2FnZXNcbiAgICBjb25zdCBzcXNQcm9jZXNzb3JMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiU1FTUHJvY2Vzc29yTGFtYmRhXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5sYW1iZGFfaGFuZGxlclwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbURvY2tlckJ1aWxkKFxuICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uXCIsIFwibGFtYmRhXCIsIFwic3FzLXByb2Nlc3NvclwiKVxuICAgICAgKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhQXJjaGl0ZWN0dXJlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQkVEUk9DS19BR0VOVENPUkVfUlVOVElNRV9BUk46IFwiTUFOVUFMTFkgQUREIEhFUkVcIiwgLy8gT25lIG1hbnVhbCBzdGVwIHRvIGJlIGRvbmUgbGF0ZXJcbiAgICAgICAgQkVEUk9DS19BR0VOVENPUkVfUVVBTElGSUVSOiBcIkRFRkFVTFRcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDaGFuZ2VkIGZyb20gJ2JlZHJvY2s6SW52b2tlQWdlbnQnIHRvICdiZWRyb2NrLWFnZW50Y29yZTpJbnZva2VBZ2VudFJ1bnRpbWUnIGZvciBBZ2VudENvcmUgY29tcGF0aWJpbGl0eVxuICAgIHNxc1Byb2Nlc3NvckxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1wiYmVkcm9jay1hZ2VudGNvcmU6SW52b2tlQWdlbnRSdW50aW1lXCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDb25maWd1cmUgU1FTIGFzIGV2ZW50IHNvdXJjZSBmb3IgdGhlIHByb2Nlc3NvciBsYW1iZGFcbiAgICBzcXNQcm9jZXNzb3JMYW1iZGEuYWRkRXZlbnRTb3VyY2UoXG4gICAgICBuZXcgU3FzRXZlbnRTb3VyY2Uoam9iTm90aWZpY2F0aW9uUXVldWUsIHtcbiAgICAgICAgYmF0Y2hTaXplOiAxMCxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIE5vdGlmaWNhdGlvbiBTZW5kZXIgTGFtYmRhIGZvciA5IEFNIGRhaWx5IG5vdGlmaWNhdGlvbnNcbiAgICBjb25zdCBub3RpZmljYXRpb25TZW5kZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgIFwiTm90aWZpY2F0aW9uU2VuZGVyTGFtYmRhXCIsXG4gICAgICB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxuICAgICAgICBoYW5kbGVyOiBcImluZGV4LmxhbWJkYV9oYW5kbGVyXCIsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcbiAgICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uXCIsIFwibGFtYmRhXCIsIFwibm90aWZpY2F0aW9uLXNlbmRlclwiKVxuICAgICAgICApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGFBcmNoaXRlY3R1cmUsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgU1RVREVOVF9QUk9GSUxFX1RBQkxFX05BTUU6IFN0dWRlbnRQcm9maWxlVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIEpPQl9SRUNPTU1FTkRBVElPTlNfVEFCTEVfTkFNRTogSm9iUmVjb21tZW5kYXRpb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgICAgIFNFTkRFUl9FTUFJTDogc2VuZGVyRW1haWwsXG4gICAgICAgICAgU01TX09SSUdJTkFUSU9OX05VTUJFUjogc2VuZGVyTnVtYmVyLFxuICAgICAgICAgIC8vIFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBmb3IgYW1wbGlmeSBpcyBhZGRkZWQgYWZ0ZXIgYW1wbGlmeSBpcyBjcmVhdGVkXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuICAgIG5vdGlmaWNhdGlvblNlbmRlckxhbWJkYS5ub2RlLmFkZERlcGVuZGVuY3koc2VuZGVySWRlbnRpdHkpO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIG5vdGlmaWNhdGlvbiBzZW5kZXJcbiAgICBTdHVkZW50UHJvZmlsZVRhYmxlLmdyYW50UmVhZERhdGEobm90aWZpY2F0aW9uU2VuZGVyTGFtYmRhKTtcbiAgICBKb2JSZWNvbW1lbmRhdGlvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobm90aWZpY2F0aW9uU2VuZGVyTGFtYmRhKTtcblxuICAgIG5vdGlmaWNhdGlvblNlbmRlckxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1wic2VzOlNlbmRFbWFpbFwiLCBcInNlczpTZW5kUmF3RW1haWxcIl0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IFNNUyBWb2ljZSB2MiBwZXJtaXNzaW9uc1xuICAgIG5vdGlmaWNhdGlvblNlbmRlckxhbWJkYS5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwic21zLXZvaWNlOlNlbmRUZXh0TWVzc2FnZVwiLFxuICAgICAgICAgIFwic21zLXZvaWNlOlNlbmRWb2ljZU1lc3NhZ2VcIixcbiAgICAgICAgICBcInNtcy12b2ljZTpEZXNjcmliZUNvbmZpZ3VyYXRpb25TZXRzXCIsXG4gICAgICAgICAgXCJzbXMtdm9pY2U6RGVzY3JpYmVQb29sc1wiLFxuICAgICAgICAgIFwic21zLXZvaWNlOkxpc3RQb29sc1wiLFxuICAgICAgICAgIFwic21zLXZvaWNlOkRlc2NyaWJlUGhvbmVOdW1iZXJzXCIsXG4gICAgICAgICAgXCJzbXMtdm9pY2U6TGlzdFBvb2xPcmlnaW5hdGlvbklkZW50aXRpZXNcIlxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBydWxlIHRvIHRyaWdnZXIgbm90aWZpY2F0aW9uIHNlbmRlciBhdCA5IEFNIGRhaWx5XG4gICAgY29uc3QgZGFpbHlOb3RpZmljYXRpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKFxuICAgICAgdGhpcyxcbiAgICAgIFwiRGFpbHlOb3RpZmljYXRpb25SdWxlXCIsXG4gICAgICB7XG4gICAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7IG1pbnV0ZTogXCIwXCIsIGhvdXI6IFwiMTZcIiB9KSxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VuZCBkYWlseSBub3RpZmljYXRpb25zIGF0IDkgQU0gTVNUXCIsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGRhaWx5Tm90aWZpY2F0aW9uUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihub3RpZmljYXRpb25TZW5kZXJMYW1iZGEpXG4gICAgKTtcbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIEJlZHJvY2sgQWdlbnRDb3JlIGV4ZWN1dGlvblxuICAgIGNvbnN0IGJlZHJvY2tBZ2VudENvcmVFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiQmVkcm9ja0FnZW50Q29yZUV4ZWN1dGlvblJvbGVcIiwge1xuICAgICAgcm9sZU5hbWU6IFwiQmVkcm9ja0FnZW50Q29yZUV4ZWN1dGlvblJvbGVcIixcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiYmVkcm9jay1hZ2VudGNvcmUuYW1hem9uYXdzLmNvbVwiKSxcbiAgICB9KTtcblxuICAgIC8vIEF0dGFjaCBtYW5hZ2VkIHBvbGljaWVzXG4gICAgYmVkcm9ja0FnZW50Q29yZUV4ZWN1dGlvblJvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcIkFtYXpvbkJlZHJvY2tGdWxsQWNjZXNzXCIpXG4gICAgKTtcbiAgICBiZWRyb2NrQWdlbnRDb3JlRXhlY3V0aW9uUm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwiQW1hem9uRHluYW1vREJGdWxsQWNjZXNzX3YyXCIpXG4gICAgKTtcbiAgICBiZWRyb2NrQWdlbnRDb3JlRXhlY3V0aW9uUm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwiQmVkcm9ja0FnZW50Q29yZUZ1bGxBY2Nlc3NcIilcbiAgICApO1xuXG4gICAgLy8gQWRkIGZ1bGwgYWNjZXNzIHBvbGljaWVzIGZvciBsb2dzLCBFQ1IsIFgtUmF5LCBhbmQgQ2xvdWRXYXRjaFxuICAgIGJlZHJvY2tBZ2VudENvcmVFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImxvZ3M6KlwiLFxuICAgICAgICAgIFwiZWNyOipcIixcbiAgICAgICAgICBcInhyYXk6KlwiLFxuICAgICAgICAgIFwiY2xvdWR3YXRjaDoqXCIsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIElkZW50aXR5IFBvb2wgZm9yIHVuYXV0aGVudGljYXRlZCAoZ3Vlc3QpIGFjY2Vzc1xuICAgIGNvbnN0IGlkZW50aXR5UG9vbCA9IG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbCh0aGlzLCBcIkpvYlNlYXJjaElkZW50aXR5UG9vbFwiLCB7XG4gICAgICBpZGVudGl0eVBvb2xOYW1lOiBgam9ic2VhcmNoLWlkZW50aXR5LXBvb2wtJHt0aW1lc3RhbXB9YCxcbiAgICAgIGFsbG93VW5hdXRoZW50aWNhdGVkSWRlbnRpdGllczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgdW5hdXRoZW50aWNhdGVkIHVzZXJzIHdpdGggbWluaW1hbCBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IHVuYXV0aGVudGljYXRlZFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJVbmF1dGhlbnRpY2F0ZWRSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5GZWRlcmF0ZWRQcmluY2lwYWwoXG4gICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmF1ZFwiOiBpZGVudGl0eVBvb2wucmVmLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgXCJGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlXCI6IHtcbiAgICAgICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOmFtclwiOiBcInVuYXV0aGVudGljYXRlZFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIFwic3RzOkFzc3VtZVJvbGVXaXRoV2ViSWRlbnRpdHlcIlxuICAgICAgKSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IFMzIHdyaXRlIGFjY2VzcyB0byByZXN1bWUgYnVja2V0XG4gICAgUmVzdW1lQnVja2V0LmdyYW50V3JpdGUodW5hdXRoZW50aWNhdGVkUm9sZSk7XG5cbiAgICAvLyBBdHRhY2ggcm9sZXMgdG8gaWRlbnRpdHkgcG9vbFxuICAgIG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50KHRoaXMsIFwiSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnRcIiwge1xuICAgICAgaWRlbnRpdHlQb29sSWQ6IGlkZW50aXR5UG9vbC5yZWYsXG4gICAgICByb2xlczoge1xuICAgICAgICB1bmF1dGhlbnRpY2F0ZWQ6IHVuYXV0aGVudGljYXRlZFJvbGUucm9sZUFybixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBtYWluQnJhbmNoID0gYW1wbGlmeUFwcC5hZGRCcmFuY2goXCJtYWluXCIsIHtcbiAgICAgIGF1dG9CdWlsZDogdHJ1ZSxcbiAgICAgIHN0YWdlOiBcIlBST0RVQ1RJT05cIixcbiAgICB9KTtcblxuICAgIC8vIEFkZCBBTVBMSUZZX0FQUF9VUkwgdG8gbm90aWZpY2F0aW9uIHNlbmRlciBMYW1iZGEgdXNpbmcgdGhlIGJyYW5jaC1zcGVjaWZpYyBVUkxcbiAgICBub3RpZmljYXRpb25TZW5kZXJMYW1iZGEuYWRkRW52aXJvbm1lbnQoJ0FNUExJRllfQVBQX1VSTCcsIGFtcGxpZnlBcHBVcmwpO1xuXG4gICAgZ2l0aHViVG9rZW5fc2VjcmV0X21hbmFnZXIuZ3JhbnRSZWFkKGFtcGxpZnlBcHApO1xuXG4gICAgbmV3IEF3c0N1c3RvbVJlc291cmNlKHRoaXMsIFwiVHJpZ2dlckFtcGxpZnlCdWlsZFwiLCB7XG4gICAgICBvbkNyZWF0ZToge1xuICAgICAgICBzZXJ2aWNlOiBcIkFtcGxpZnlcIixcbiAgICAgICAgYWN0aW9uOiBcInN0YXJ0Sm9iXCIsXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICBhcHBJZDogYW1wbGlmeUFwcC5hcHBJZCxcbiAgICAgICAgICBicmFuY2hOYW1lOiBtYWluQnJhbmNoLmJyYW5jaE5hbWUsIC8vIGUuZy4gXCJtYWluXCJcbiAgICAgICAgICBqb2JUeXBlOiBcIlJFTEVBU0VcIiwgLy8gb3IgUkVCVUlMRCAvIFJFVFJZIC8gZXRjLlxuICAgICAgICB9LFxuICAgICAgICAvLyBlbnN1cmUgYSBuZXcgcGh5c2ljYWwgSUQgb24gZXZlcnkgZGVwbG95IHNvIGl0IGFjdHVhbGx5IHJ1bnMgZWFjaCB0aW1lXG4gICAgICAgIHBoeXNpY2FsUmVzb3VyY2VJZDogUGh5c2ljYWxSZXNvdXJjZUlkLm9mKFxuICAgICAgICAgIGAke2FtcGxpZnlBcHAuYXBwSWR9LSR7bWFpbkJyYW5jaC5icmFuY2hOYW1lfS0ke0RhdGUubm93KCl9YFxuICAgICAgICApLFxuICAgICAgfSxcbiAgICAgIC8vIGlmIHlvdSBhbHNvIHdhbnQgaXQgb24gdXBkYXRlczpcbiAgICAgIG9uVXBkYXRlOiB7XG4gICAgICAgIHNlcnZpY2U6IFwiQW1wbGlmeVwiLFxuICAgICAgICBhY3Rpb246IFwic3RhcnRKb2JcIixcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIGFwcElkOiBhbXBsaWZ5QXBwLmFwcElkLFxuICAgICAgICAgIGJyYW5jaE5hbWU6IG1haW5CcmFuY2guYnJhbmNoTmFtZSxcbiAgICAgICAgICBqb2JUeXBlOiBcIlJFTEVBU0VcIixcbiAgICAgICAgfSxcbiAgICAgICAgcGh5c2ljYWxSZXNvdXJjZUlkOiBQaHlzaWNhbFJlc291cmNlSWQub2YoXG4gICAgICAgICAgYCR7YW1wbGlmeUFwcC5hcHBJZH0tJHttYWluQnJhbmNoLmJyYW5jaE5hbWV9LSR7RGF0ZS5ub3coKX1gXG4gICAgICAgICksXG4gICAgICB9LFxuICAgICAgcG9saWN5OiBBd3NDdXN0b21SZXNvdXJjZVBvbGljeS5mcm9tU2RrQ2FsbHMoe1xuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAvLyB0aGUgYXBwIGl0c2VsZlxuICAgICAgICAgIGBhcm46YXdzOmFtcGxpZnk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmFwcHMvJHthbXBsaWZ5QXBwLmFwcElkfWAsXG4gICAgICAgICAgLy8gYWxsb3cgc3RhcnRKb2Igb24gYW55IGJyYW5jaC9qb2IgdW5kZXIgeW91ciBcIm1haW5cIiBicmFuY2hcbiAgICAgICAgICBgYXJuOmF3czphbXBsaWZ5OiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTphcHBzLyR7YW1wbGlmeUFwcC5hcHBJZH0vYnJhbmNoZXMvJHttYWluQnJhbmNoLmJyYW5jaE5hbWV9L2pvYnMvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdG8gQW1wbGlmeSBicmFuY2hcbiAgICBtYWluQnJhbmNoLmFkZEVudmlyb25tZW50KCdSRUFDVF9BUFBfQUdFTlRfUVVBTElGSUVSJywgJ0RFRkFVTFQnKTtcbiAgICBtYWluQnJhbmNoLmFkZEVudmlyb25tZW50KCdSRUFDVF9BUFBfQUdFTlRfUlVOVElNRV9BUk4nLCAnTUFOVUFMTFkgQUREIEhFUkUnKTtcbiAgICBtYWluQnJhbmNoLmFkZEVudmlyb25tZW50KCdSRUFDVF9BUFBfQVdTX1JFR0lPTicsIGF3c19yZWdpb24pO1xuICAgIG1haW5CcmFuY2guYWRkRW52aXJvbm1lbnQoJ1JFQUNUX0FQUF9BR0VOVF9QUk9YWV9VUkwnLCBhZ2VudFByb3h5VXJsLnVybCk7XG4gICAgbWFpbkJyYW5jaC5hZGRFbnZpcm9ubWVudCgnUkVBQ1RfQVBQX1JFU1VNRV9QUk9DRVNTT1JfVVJMJywgcmVzdW1lUHJvY2Vzc29yVXJsLnVybCk7XG4gICAgbWFpbkJyYW5jaC5hZGRFbnZpcm9ubWVudCgnUkVBQ1RfQVBQX1NBVkVfUFJPRklMRV9VUkwnLCBzYXZlUHJvZmlsZVVybC51cmwpO1xuICAgIG1haW5CcmFuY2guYWRkRW52aXJvbm1lbnQoJ1JFQUNUX0FQUF9KT0JfUkVDT01NRU5EQVRJT05TX0FQSV9VUkwnLCBqb2JSZWNvbW1lbmRhdGlvbnNBcGkudXJsKTtcbiAgICBtYWluQnJhbmNoLmFkZEVudmlyb25tZW50KCdSRUFDVF9BUFBfUkVTVU1FX0JVQ0tFVCcsIFJlc3VtZUJ1Y2tldC5idWNrZXROYW1lKTtcbiAgICBtYWluQnJhbmNoLmFkZEVudmlyb25tZW50KCdSRUFDVF9BUFBfQ09HTklUT19JREVOVElUWV9QT09MX0lEJywgaWRlbnRpdHlQb29sLnJlZik7XG5cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiRG9ja2VySW1hZ2VVUklcIiwge1xuICAgICAgdmFsdWU6IGpvYlNlYXJjaEFnZW50SW1hZ2UuaW1hZ2VVcmksXG4gICAgICBkZXNjcmlwdGlvbjogXCJCdWlsdCBEb2NrZXIgSW1hZ2UgVVJJIChDREstbWFuYWdlZCBFQ1IpXCIsXG4gICAgICBleHBvcnROYW1lOiBcIkpvYlNlYXJjaEFnZW50SW1hZ2VVUklcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiS25vd2xlZGdlQmFzZUlkXCIsIHtcbiAgICAgIHZhbHVlOiBrYi5rbm93bGVkZ2VCYXNlSWQsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgXCJLbm93bGVkZ2UgQmFzZSBJRCBmb3Igam9iIHNlYXJjaCAocGFzc2VkIGFzIGJ1aWxkIGFyZyB0byBEb2NrZXIpXCIsXG4gICAgICBleHBvcnROYW1lOiBcIkpvYlNlYXJjaEtub3dsZWRnZUJhc2VJZFwiLFxuICAgIH0pO1xuXG4gICAgLy8gRXhwb3J0IHRoZSB0YWJsZSBuYW1lIGZvciByZWZlcmVuY2VcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkpvYlJlY29tbWVuZGF0aW9uc1RhYmxlTmFtZVwiLCB7XG4gICAgICB2YWx1ZTogSm9iUmVjb21tZW5kYXRpb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiRHluYW1vREIgdGFibGUgZm9yIHN0b3Jpbmcgam9iIHJlY29tbWVuZGF0aW9ucyBwZXIgdXNlclwiLFxuICAgICAgZXhwb3J0TmFtZTogXCJKb2JSZWNvbW1lbmRhdGlvbnNUYWJsZU5hbWVcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiUmVzdW1lQnVja2V0TmFtZVwiLCB7XG4gICAgICB2YWx1ZTogUmVzdW1lQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJTMyBidWNrZXQgZm9yIHN0b3JpbmcgdXNlciByZXN1bWVzXCIsXG4gICAgICBleHBvcnROYW1lOiBcIlJlc3VtZUJ1Y2tldE5hbWVcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQ2FycmllclJlc291cmNlc0J1Y2tldE5hbWVcIiwge1xuICAgICAgdmFsdWU6IGNhcnJpZXJSZXNvdXJjZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlMzIGJ1Y2tldCBmb3IgY2FycmllciByZXNvdXJjZXMgd2l0aCBwdWJsaWMvIGFuZCBwcml2YXRlLyBmb2xkZXJzXCIsXG4gICAgICBleHBvcnROYW1lOiBcIkNhcnJpZXJSZXNvdXJjZXNCdWNrZXROYW1lXCIsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlNhdmVQcm9maWxlVXJsXCIsIHtcbiAgICAgIHZhbHVlOiBzYXZlUHJvZmlsZVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogXCJMYW1iZGEgRnVuY3Rpb24gVVJMIGZvciBzYXZlIHByb2ZpbGUgZW5kcG9pbnRcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU2F2ZVByb2ZpbGVVcmxcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiUmVzdW1lUHJvY2Vzc29yVXJsXCIsIHtcbiAgICAgIHZhbHVlOiByZXN1bWVQcm9jZXNzb3JVcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246IFwiTGFtYmRhIEZ1bmN0aW9uIFVSTCBmb3IgcmVzdW1lIHBhcnNlciBlbmRwb2ludFwiLFxuICAgICAgZXhwb3J0TmFtZTogXCJSZXN1bWVQcm9jZXNzb3JVcmxcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQWdlbnRQcm94eVVybFwiLCB7XG4gICAgICB2YWx1ZTogYWdlbnRQcm94eVVybC51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogXCJMYW1iZGEgRnVuY3Rpb24gVVJMIGZvciBhZ2VudCBwcm94eSBlbmRwb2ludFwiLFxuICAgICAgZXhwb3J0TmFtZTogXCJBZ2VudFByb3h5VXJsXCIsXG4gICAgfSk7XG5cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiSm9iUmVjb21tZW5kYXRpb25zQXBpVXJsXCIsIHtcbiAgICAgIHZhbHVlOiBqb2JSZWNvbW1lbmRhdGlvbnNBcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246IFwiQVBJIEdhdGV3YXkgVVJMIGZvciBqb2IgcmVjb21tZW5kYXRpb25zIGxvb2t1cCBmcm9tIFNNUyBsaW5rc1wiLFxuICAgICAgZXhwb3J0TmFtZTogXCJKb2JSZWNvbW1lbmRhdGlvbnNBcGlVcmxcIixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiU1FTUXVldWVVcmxcIiwge1xuICAgICAgdmFsdWU6IGpvYk5vdGlmaWNhdGlvblF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246IFwiU1FTIFF1ZXVlIFVSTCBmb3Igam9iIG5vdGlmaWNhdGlvbnNcIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiU1FTUXVldWVVcmxcIixcbiAgICB9KTtcblxuICAgIC8vIFNNUyBWb2ljZSB2MiBkZXRhaWxzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJTTVNPcmlnaW5hdGlvbk51bWJlclwiLCB7XG4gICAgICB2YWx1ZTogc2VuZGVyTnVtYmVyLFxuICAgICAgZGVzY3JpcHRpb246IFwiU01TIE9yaWdpbmF0aW9uIE51bWJlciBmb3Igam9iIG5vdGlmaWNhdGlvbnMgKGV4aXN0aW5nIFRFTl9ETEMgbnVtYmVyKVwiLFxuICAgICAgZXhwb3J0TmFtZTogXCJTTVNPcmlnaW5hdGlvbk51bWJlclwiLFxuICAgIH0pO1xuXG4gICAgLy8gRXhwb3J0IHRoZSB0YWJsZSBuYW1lIGZvciByZWZlcmVuY2VcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlN0dWRlbnRQcm9maWxlVGFibGVPdXRwdXRcIiwge1xuICAgICAgdmFsdWU6IFN0dWRlbnRQcm9maWxlVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246IFwiRHluYW1vREIgdGFibGUgZm9yIHN0b3Jpbmcgc3R1ZGVudCBwcm9maWxlc1wiLFxuICAgICAgZXhwb3J0TmFtZTogXCJTdHVkZW50UHJvZmlsZVRhYmxlXCIsXG4gICAgfSk7XG5cbiAgICAvLyBFeHBvcnQgQ29nbml0byBJZGVudGl0eSBQb29sIElEXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJDb2duaXRvSWRlbnRpdHlQb29sSWRcIiwge1xuICAgICAgdmFsdWU6IGlkZW50aXR5UG9vbC5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb2duaXRvIElkZW50aXR5IFBvb2wgSUQgZm9yIHVuYXV0aGVudGljYXRlZCBhY2Nlc3Mgd2l0aCBtaW5pbWFsIEFnZW50Q29yZSBwZXJtaXNzaW9uc1wiLFxuICAgICAgZXhwb3J0TmFtZTogXCJDb2duaXRvSWRlbnRpdHlQb29sSWRcIixcbiAgICB9KTtcblxuICAgIC8vIEV4cG9ydCB0aGUgcm9sZSBBUk5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkJlZHJvY2tBZ2VudENvcmVFeGVjdXRpb25Sb2xlQXJuXCIsIHtcbiAgICAgIHZhbHVlOiBiZWRyb2NrQWdlbnRDb3JlRXhlY3V0aW9uUm9sZS5yb2xlQXJuLFxuICAgICAgZGVzY3JpcHRpb246IFwiSUFNIHJvbGUgQVJOIGZvciBCZWRyb2NrIEFnZW50Q29yZSBleGVjdXRpb25cIixcbiAgICAgIGV4cG9ydE5hbWU6IFwiQmVkcm9ja0FnZW50Q29yZUV4ZWN1dGlvblJvbGVBcm5cIixcbiAgICB9KTtcblxuICAgIC8vIEV4cG9ydCBBbXBsaWZ5IGFwcCBVUkwgKGJyYW5jaC1zcGVjaWZpYylcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFtcGxpZnlBcHBVcmxcIiwge1xuICAgICAgdmFsdWU6IGFtcGxpZnlBcHBVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogXCJBbXBsaWZ5IGFwcCBVUkwgZm9yIFNNUyBsaW5rcyBhbmQgZnJvbnRlbmQgYWNjZXNzIChicmFuY2gtc3BlY2lmaWMpXCIsXG4gICAgICBleHBvcnROYW1lOiBcIkFtcGxpZnlBcHBVcmxcIixcbiAgICB9KTtcbiAgfVxufVxuIl19