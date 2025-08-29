import json
import boto3

def lambda_handler(event, context):
    """Process SQS messages and trigger job search agent for notifications"""
    
    for record in event['Records']:
        try:
            message = json.loads(record['body'])
            email = message.get('email')
            session_id = message.get('session_id')
            notification_method = message.get('notification_method', 'email')
            
            # TODO: Invoke job search agent with user context after deployment
            print(f"Processing job notifications for {email} via {notification_method}")
            
        except Exception as e:
            print(f"Error processing message: {str(e)}")
    
    return {'statusCode': 200}