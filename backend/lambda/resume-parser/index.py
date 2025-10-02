import json
import boto3
from typing import Dict, Any

bedrock_runtime = boto3.client('bedrock-runtime')
s3_client = boto3.client('s3')

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
                    "text": """Extract structured information from this resume and return ONLY a valid JSON object.

IMPORTANT: Your response must start with { and end with }. Do not include any text before or after the JSON.

Return a JSON object with these exact fields. If any field cannot be found in the resume, use "N/A" as the value:

{
  "fullName": "Full Name or N/A",
  "location": "City, State or N/A",
  "headline": "Professional headline (100-200 chars) or N/A",
  "aboutMe": "Brief professional summary (100-200 chars) or N/A",
  "education": "Education details (100-200 chars) or N/A",
  "experience": "Work experience details (as-is with the description, do not summarize) or N/A",
  "email": "Email address or N/A",
  "phone": "Phone number in +1XXXXXXXXXX format (10 digits after +1) or N/A",
  "preferredJobRole": "Preferred job role titles (Create this field based on the resume, max 3 roles) or N/A",
  "linkedin": "LinkedIn profile URL or N/A"
}

Return only the JSON object:"""
                }
            ]
        }
    ]
    
    response = bedrock_runtime.converse(
        modelId='us.amazon.nova-pro-v1:0',
        messages=messages
    )
    
    response_text = response['output']['message']['content'][0]['text'].strip()
    
    # Ensure response starts with { and ends with }
    if not response_text.startswith('{'):
        start_idx = response_text.find('{')
        if start_idx != -1:
            response_text = response_text[start_idx:]
    
    if not response_text.endswith('}'):
        end_idx = response_text.rfind('}')
        if end_idx != -1:
            response_text = response_text[:end_idx + 1]
    
    return json.loads(response_text)

def handler(event, context):
    """
    Lambda handler for onboarding flow resume parsing.

    Expected event format:
    {
        "s3_path": "s3://bucket-name/path/to/resume.pdf",
    }

    Returns parsed resume data for frontend form population.
    """
    try:
        # Extract s3_path from Function URL payload
        s3_path = json.loads(event['body'])['s3_path']

        if not s3_path:
            raise ValueError("Missing required parameter: s3_path")

        # Extract and parse resume using Nova Pro
        parsed_data = extract_and_parse_resume(s3_path)

        # Return parsed data
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'parsed_data': parsed_data,
                'message': 'Resume parsed successfully'
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