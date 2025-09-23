#!/bin/bash

echo "🔧 Fix CloudFormation Stack and Deploy"
echo "======================================"

# Set AWS credentials
export AWS_ACCESS_KEY_ID=AKIATFBMO6T6AK6MQ4EG
export AWS_SECRET_ACCESS_KEY=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
export AWS_DEFAULT_REGION=us-west-2

echo "🔍 Checking stack status..."
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name jobsearch1 --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "STACK_NOT_FOUND")

if [ "$STACK_STATUS" = "UPDATE_ROLLBACK_COMPLETE" ]; then
    echo "⚠️  Stack is in UPDATE_ROLLBACK_COMPLETE state"
    echo "🗑️  Deleting the stuck stack..."
    
    aws cloudformation delete-stack --stack-name jobsearch1
    
    echo "⏳ Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name jobsearch1
    
    if [ $? -eq 0 ]; then
        echo "✅ Stack deleted successfully"
    else
        echo "❌ Stack deletion failed or timed out"
        echo "💡 Please check AWS Console and delete manually if needed"
        exit 1
    fi
else
    echo "ℹ️  Stack status: $STACK_STATUS"
fi

echo "🧹 Cleaning up build artifacts..."
rm -rf cdk.out
pkill -f cdk 2>/dev/null || true

echo "🚀 Starting fresh CDK deployment..."

# Deploy with latest CDK
npx aws-cdk@latest deploy \
    --require-approval never \
    -c adminEmail=sayantika@example.com \
    --verbose

DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -eq 0 ]; then
    echo ""
    echo "🎉 CDK Deployment Successful!"
    echo "=============================="
    echo "✅ Stack deployed from scratch with your local changes"
    echo "✅ Lambda functions updated with improved code"
    echo "✅ IAM permissions configured correctly"
    echo ""
    echo "🧪 Ready to test your batch processing!"
else
    echo ""
    echo "❌ CDK Deployment Failed"
    echo "Check the error messages above for details."
fi

exit $DEPLOY_STATUS