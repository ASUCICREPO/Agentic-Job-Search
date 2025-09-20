import json
import boto3
import os


session = boto3.Session()
region = os.environ.get('AWS_REGION', 'us-east-1')
client = session.client('bedrock-agentcore', region_name=region)

def lambda_handler(event, context):
    """SQS triggered processor - processes individual job notification requests"""
    agent_id = os.environ['BEDROCK_AGENT_ID']
    agent_alias_id = os.environ['BEDROCK_AGENT_ALIAS_ID']
    
    for record in event['Records']:
        try:
            message = json.loads(record['body'])
            email = message.get('email')
            session_id = message.get('session_id')
            communication_method = message.get('communication_method', 'email')

            if email and '@' in email:
                payload = {
                    'prompt': 'Find me the latest job opportunities based on my profile and preferences. This is for daily job notifications.',
                    'email': email,
                    'session_id': session_id,
                    'communication_method': communication_method
                }
                
                client.invoke_agent(
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