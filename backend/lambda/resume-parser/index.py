import json
import boto3
import os
from typing import Dict, Any

bedrock_runtime = boto3.client('bedrock-runtime')
s3_client = boto3.client('s3')
lambda_client = boto3.client('lambda')

def extract_and_parse_resume(s3_uri: str) -> Dict[str, Any]:
    """Extract and parse resume using Nova Pro document understanding"""
    if not s3_uri.startswith('s3://') or '/' not in s3_uri[5:]:
        raise ValueError("Invalid S3 URI format")
    bucket, key = s3_uri.replace('s3://', '').split('/', 1)
    response = s3_client.get_object(Bucket=bucket, Key=key)
    doc_bytes = response['Body'].read()
    
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "document": {
                        "format": "pdf",
                        "name": "resume_document",
                        "source": {
                            "bytes": doc_bytes
                        }
                    }
                },
                {
                    "text": """Extract structured information from this resume and return as JSON:

Return a JSON object with these fields:
- fullName: Full Name
- location: Location (City, State)
- headline: Headline (Your First Name)
- aboutMe: About Me (100–200 Character Description)
- education: Education (Select a School)
- experience: Experience (List your Experience Here)
- email: Email
- phone: Phone Number
- interests: Interests (List Interests here)
- linkedin: LinkedIn Profile URL

JSON:"""
                }
            ]
        }
    ]
    
    response = bedrock_runtime.converse(
        modelId='us.amazon.nova-pro-v1:0',
        messages=messages
    )
    
    return json.loads(response['output']['message']['content'][0]['text'])

def handler(event, context):
    """
    Lambda handler for onboarding flow resume parsing.
    
    Expected event format:
    {
        "s3_path": "s3://bucket-name/path/to/resume.pdf",
        "user_id": "optional_user_identifier"
    }
    
    Returns parsed resume data for frontend form population.
    """
    try:
        # Get S3 path from event
        s3_path = event.get('s3_path')
        if not s3_path:
            raise ValueError("Missing required parameter: s3_path")
        
        # Extract and parse resume using Nova Pro
        parsed_data = extract_and_parse_resume(s3_path)
        
        # Automatically save profile to DynamoDB
        save_profile_payload = {
            'parsed_data': parsed_data,
            'notification_method': 'email'
        }
        
        lambda_client.invoke(
            FunctionName=os.environ.get('SAVE_PROFILE_FUNCTION_NAME'),
            InvocationType='Event',
            Payload=json.dumps(save_profile_payload)
        )
        
        # Return parsed data for frontend form population
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'parsed_data': parsed_data,
                'message': 'Resume parsed and profile saved successfully'
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'message': 'Failed to parse resume'
            })
        }