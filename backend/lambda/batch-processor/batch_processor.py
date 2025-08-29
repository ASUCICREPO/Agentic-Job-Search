import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

def lambda_handler(event, context):
    table_name = os.environ['DYNAMODB_TABLE_NAME']
    queue_url = os.environ['SQS_QUEUE_URL']
    
    table = dynamodb.Table(table_name)
    
    try:
        # Scan table for all student records
        response = table.scan()
        
        for item in response['Items']:
            session_id = item.get('sessionID')
            email = item.get('actionID')  # actionID is the email
            opt_in_status = item.get('optInStatus', False)
            notification_method = item.get('notificationMethod', 'email')
            
            # Only process if user has opted in and email exists
            if opt_in_status and email and '@' in email:
                # Send message to SQS for job notifications
                message = {
                    'email': email,
                    'session_id': session_id,
                    'notification_method': notification_method,
                    'action': 'send_job_notifications'
                }
                
                sqs.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps(message)
                )
        
        return {
            'statusCode': 200,
            'body': json.dumps('Batch processing completed successfully')
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error processing batch: {str(e)}')
        }