import json
import boto3
import os
from typing import Dict, Any
from datetime import datetime

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Lambda function to save student profile data to DynamoDB
    """

    try:
        table_name = os.environ.get('STUDENT_PROFILE_TABLE_NAME')
        if not table_name:
            raise ValueError("STUDENT_PROFILE_TABLE_NAME environment variable not set")
        
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        # Extract parsed resume data from Function URL payload
        parsed_data = json.loads(event['body'])['parsed_data']
        
        # Validate required fields
        if not parsed_data.get('email'):
            raise ValueError("Email is required")
        
        print(f"🔍 Parsed data: {json.dumps(parsed_data)}")
        # Use email as actionID with underscore replacement
        email = parsed_data.get('email')
        sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
        # Fix consecutive colons
        action_id = sanitized.replace('::', ':_')
        
        # Create DynamoDB item
        item = {
            'actionID': action_id,
            'email': email,
            'fullName': parsed_data.get('fullName', ''),
            'location': parsed_data.get('location', ''),
            'headline': parsed_data.get('headline', ''),
            'aboutMe': parsed_data.get('aboutMe', ''),
            'education': parsed_data.get('education', ''),
            'experience': parsed_data.get('experience', ''),
            'phone': parsed_data.get('phone', ''),
            'interests': parsed_data.get('interests', ''),
            'linkedin': parsed_data.get('linkedin', ''),
            'notificationMethod': event.get('notification_method', 'email'),
            'timestamp': datetime.utcnow().isoformat()
        }

        print(f"💾 Putting item to DynamoDB: {json.dumps(item)}")
        table.put_item(Item=item)
        print("✅ Item successfully saved to DynamoDB")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Student profile saved successfully',
                'action_id': action_id
            })
        }
        
    except Exception as e:
        print(f"❌ Error in save-profile Lambda: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to save student profile'
            })
        }