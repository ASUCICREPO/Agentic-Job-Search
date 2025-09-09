import json
import boto3
import os
from typing import Dict, Any
import PyPDF2
from io import BytesIO

bedrock_runtime = boto3.client('bedrock-runtime')
s3_client = boto3.client('s3')
lambda_client = boto3.client('lambda')

def extract_text_from_pdf(s3_uri: str) -> str:
    """Extract text from PDF stored in S3"""
    bucket, key = s3_uri.replace('s3://', '').split('/', 1)
    
    response = s3_client.get_object(Bucket=bucket, Key=key)
    pdf_content = response['Body'].read()
    
    pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_content))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() + "\n"
    
    return text.strip()

def parse_with_nova_pro(text: str) -> str:
    """Parse resume text using Nova Pro"""
    
    prompt = f"""Extract structured information from this resume text and return as JSON:

{text}

Return a JSON object with these fields:
- name: Full name
- email: Email address
- phone: Phone number
- skills: Array of skills
- experience: Array of work experience objects with company, position, duration
- education: Array of education objects with institution, degree, year
- summary: Brief professional summary

JSON:"""
    
    body = {
        "inputText": prompt,
        "textGenerationConfig": {
            "maxTokenCount": 2000,
            "temperature": 0.1
        }
    }
    
    response = bedrock_runtime.invoke_model(
        modelId='amazon.nova-pro-v1:0',
        body=json.dumps(body)
    )
    
    result = json.loads(response['body'].read())
    return result['results'][0]['outputText']

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
        
        # Extract text from PDF
        resume_text = extract_text_from_pdf(s3_path)
        
        # Parse with Nova Pro
        parsed_data = parse_with_nova_pro(resume_text)
        parsed_json = json.loads(parsed_data)
        
        # Return parsed data for frontend form population
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'parsed_data': parsed_json,
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