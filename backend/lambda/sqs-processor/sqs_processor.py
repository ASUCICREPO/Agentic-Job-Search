import json
import boto3
import os

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

def lambda_handler(event, context):
    """SQS triggered processor - processes individual job notification requests"""
    agent_id = os.environ['BEDROCK_AGENT_ID']
    agent_alias_id = os.environ['BEDROCK_AGENT_ALIAS_ID']
    
    for record in event['Records']:
        try:
            message = json.loads(record['body'])
            email = message.get('email')
            session_id = message.get('session_id')
            notification_method = message.get('notification_method', 'email')
            
            if email and '@' in email:
                payload = {
                    'prompt': 'Find me the latest job opportunities based on my profile and preferences. This is for daily job notifications.',
                    'email': email,
                    'session_id': session_id,
                    'notification_method': notification_method
                }
                
                bedrock_agent_runtime.invoke_agent(
                    agentId=agent_id,
                    agentAliasId=agent_alias_id,
                    sessionId=session_id,
                    inputText=json.dumps(payload)
                )
                
                print(f"Processed job notification for {email}")
                
        except Exception as e:
            print(f"Error processing SQS message: {str(e)}")
            # Let SQS handle retry logic
            raise e
    
    return {'statusCode': 200}