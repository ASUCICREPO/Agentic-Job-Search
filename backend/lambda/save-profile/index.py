import json
import boto3
import os
from typing import Dict, Any

dynamodb = boto3.resource('dynamodb')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Lambda function to save student profile data to DynamoDB
    """
    try:
        table_name = os.environ.get('DYNAMODB_TABLE_NAME')
        if not table_name:
            raise ValueError("DYNAMODB_TABLE_NAME environment variable not set")
        
        table = dynamodb.Table(table_name)
        
        # Extract data from event
        session_id = event.get('session_id')
        action_id = event.get('action_id')
        email = event.get('email')
        opt_in_status = event.get('opt_in_status', False)
        notification_method = event.get('notification_method', 'email')
        resume_data = event.get('resume_data')
        
        # Save to DynamoDB with proper schema
        item = {
            'sessionID': session_id,
            'actionID': action_id,
            'email': email,
            'optInStatus': opt_in_status,
            'notificationMethod': notification_method,
            'timestamp': context.aws_request_id
        }
        
        if resume_data:
            item['resume_data'] = resume_data
        
        table.put_item(Item=item)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Student profile saved successfully',
                'session_id': session_id,
                'action_id': action_id
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to save student profile'
            })
        }