import json
import boto3
import os
from boto3.dynamodb.conditions import Attr

BATCH_SIZE = 20

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

def lambda_handler(event, context):
    """EventBridge triggered batch processor - adds messages to SQS queue"""
    return process_batch()

def process_batch():
    table_name = os.environ['DYNAMODB_TABLE_NAME']
    queue_url = os.environ['SQS_QUEUE_URL']
    
    table = dynamodb.Table(table_name)
    
    try:
        # Scan table for opted-in users
        response = table.scan(
            FilterExpression=Attr('optInStatus').eq(True)
        )
        
        messages = []
        for item in response['Items']:
            action_id = item.get('actionID')
            email = item.get('email')
            communication_method = item.get('communicationMethod', 'email')

            if email and '@' in email:
                messages.append({
                    'Id': str(len(messages)),
                    'MessageBody': json.dumps({
                        'email': email,
                        'action_id': action_id,
                        'communication_method': communication_method
                    })
                })
        
        # Send messages in batches with failure checking
        count = 0
        for i in range(0, len(messages), BATCH_SIZE):
            batch = messages[i:i+BATCH_SIZE]
            sqs_response = sqs.send_message_batch(
                QueueUrl=queue_url,
                Entries=batch
            )
            
            # Check for failed messages
            if 'Failed' in sqs_response and sqs_response['Failed']:
                for failed in sqs_response['Failed']:
                    print(f"Failed to send message {failed['Id']}: {failed['Message']}")
            else:
                count += len(batch)
        
        return {
            'statusCode': 200,
            'body': json.dumps(f'Sent {count} messages to SQS')
        }
        
    except Exception as e:
        print(f"Error in batch processing: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error processing batch: {str(e)}')
        }


