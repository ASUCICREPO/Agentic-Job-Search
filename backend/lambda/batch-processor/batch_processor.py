import json
import boto3
import os
from boto3.dynamodb.conditions import Attr

BATCH_SIZE = 20

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

def lambda_handler(event, context):
    # Check if this is an SQS event (processing) or scheduled event (batch)
    if 'Records' in event:
        return process_sqs_messages(event)
    else:
        return process_batch()

def process_batch():
    table_name = os.environ['DYNAMODB_TABLE_NAME']
    queue_url = os.environ['SQS_QUEUE_URL']
    
    table = dynamodb.Table(table_name)
    
    try:
        # Scan table filtering for opted-in users only
        response = table.scan(
            FilterExpression=Attr('optInStatus').eq(True)
        )
        
        messages = []
        for item in response['Items']:
            session_id = item.get('sessionID')
            email = item.get('actionID')
            notification_method = item.get('notificationMethod', 'email')
            
            if email and '@' in email:
                messages.append({
                    'Id': str(len(messages)),
                    'MessageBody': json.dumps({
                        'email': email,
                        'session_id': session_id,
                        'notification_method': notification_method
                    })
                })
        
        # Send messages in batches of BATCH_SIZE
        count = 0
        for i in range(0, len(messages), BATCH_SIZE):
            batch = messages[i:i+BATCH_SIZE]
            sqs.send_message_batch(
                QueueUrl=queue_url,
                Entries=batch
            )
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

def process_sqs_messages(event):
    agent_id = os.environ['BEDROCK_AGENT_ID']
    agent_alias_id = os.environ['BEDROCK_AGENT_ALIAS_ID']
    
    for record in event['Records']:
        try:
            message = json.loads(record['body'])
            email = message.get('email')
            session_id = message.get('session_id')
            
            if email and '@' in email:
                payload = {
                    'prompt': 'Find me the latest job opportunities based on my profile and preferences. This is for daily job notifications.',
                    'email': email,
                    'session_id': session_id
                }
                
                bedrock_agent_runtime.invoke_agent(
                    agentId=agent_id,
                    agentAliasId=agent_alias_id,
                    sessionId=session_id,
                    inputText=json.dumps(payload)
                )
                
        except Exception as e:
            print(f"Error processing SQS message: {str(e)}")
    
    return {'statusCode': 200}
