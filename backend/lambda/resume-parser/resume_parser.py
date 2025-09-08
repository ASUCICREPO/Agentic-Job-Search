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
        # Extract parameters from event
        resume_s3_uri = event.get('resume_s3_uri')
        output_s3_uri = event.get('output_s3_uri')
        project_arn = event.get('project_arn') or os.environ.get('BDA_PROJECT_ARN')
        
        if not all([resume_s3_uri, output_s3_uri, project_arn]):
            raise ValueError("Missing required parameters: resume_s3_uri, output_s3_uri, or project_arn")
        
        # Get region and account for profile ARN
        session = boto3.Session()
        region = session.region_name
        sts_client = boto3.client('sts')
        account_id = sts_client.get_caller_identity()['Account']
        
        # Invoke Bedrock Data Automation
        response = bda_runtime_client.invoke_data_automation_async(
            inputConfiguration={
                's3Uri': resume_s3_uri
            },
            outputConfiguration={
                's3Uri': output_s3_uri
            },
            dataAutomationProfileArn=f'arn:aws:bedrock:{region}:{account_id}:data-automation-profile/us.data-automation-v1',
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