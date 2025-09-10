import json
import boto3
import os
import uuid
from datetime import datetime
from typing import Dict, Any

dynamodb = boto3.resource('dynamodb')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    try:
        # Get table name from environment
        table_name = os.environ.get('DYNAMODB_TABLE_NAME')
        if not table_name:
            raise ValueError("DYNAMODB_TABLE_NAME environment variable not set")
        
        table = dynamodb.Table(table_name)
        
        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            profile_data = json.loads(body)
        else:
            profile_data = body
        
        # Generate unique ID for the profile
        profile_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        # Prepare item for DynamoDB
        item = {
            'actionID': profile_id,
            'profileData': profile_data,
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        # Save to DynamoDB
        table.put_item(Item=item)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps({
                'message': 'Profile saved successfully',
                'profileId': profile_id
            })
        }
        
    except Exception as e:
        print(f"Error saving profile: {str(e)}")
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