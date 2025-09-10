import json
import boto3
import base64
import os
from typing import Dict, Any

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    try:
        # Parse the multipart form data
        body = event.get('body', '')
        if event.get('isBase64Encoded', False):
            body = base64.b64decode(body).decode('utf-8')
        
        # For now, return mock data until you implement actual resume parsing
        # You would typically use Bedrock or Textract here to parse the resume
        
        mock_profile_data = {
            "fullName": "John Doe",
            "location": "Phoenix, AZ",
            "headline": "Software Engineer",
            "aboutMe": "Experienced software engineer with expertise in web development",
            "education": "Bachelor's in Computer Science",
            "experience": "5 years of software development experience",
            "email": "john.doe@example.com",
            "phone": "(555) 123-4567",
            "interests": "Technology, Innovation, Problem Solving",
            "linkedin": "https://linkedin.com/in/johndoe"
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps(mock_profile_data)
        }
        
    except Exception as e:
        print(f"Error processing resume: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps({'error': str(e)})
        }