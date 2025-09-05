import json
import boto3
import os
from typing import Dict, Any

bda_runtime_client = boto3.client('bedrock-data-automation-runtime')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Lambda function to parse resume PDFs using Bedrock Data Automation
    """
    try:
        # Extract S3 URI from event
        resume_s3_uri = event.get('resume_s3_uri')
        output_s3_uri = event.get('output_s3_uri')
        project_arn = os.environ.get('BDA_PROJECT_ARN')
        
        if not all([resume_s3_uri, output_s3_uri, project_arn]):
            raise ValueError("Missing required parameters: resume_s3_uri, output_s3_uri, or BDA_PROJECT_ARN")
        
        # Invoke Bedrock Data Automation
        response = bda_runtime_client.invoke_data_automation_async(
            inputConfiguration={
                's3Uri': resume_s3_uri
            },
            outputConfiguration={
                's3Uri': output_s3_uri
            },
            dataAutomationConfiguration={
                'dataAutomationProjectArn': project_arn
            }
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'invocationArn': response['invocationArn'],
                'message': 'Resume parsing initiated successfully'
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to parse resume'
            })
        }