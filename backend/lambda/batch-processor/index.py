"""
ENHANCED BATCH PROCESSOR LAMBDA
===============================
This Lambda function is triggered by EventBridge daily to process opted-in users for job notifications.

Key Enhancements Made:
1. Added comprehensive user profile extraction from DynamoDB
2. Improved session ID generation (33+ characters for AgentCore compatibility)
3. Enhanced error handling and logging
4. Fixed environment variable usage (no hardcoded values)
5. Added proper user profile data to SQS messages for personalized job search

Workflow:
1. Scans DynamoDB for users with optInStatus = true
2. Extracts complete user profile (name, location, job preferences, etc.)
3. Generates unique session IDs for each user
4. Sends user data to SQS queue for processing by SQS processor
"""

import json
import boto3
import os
import uuid
from boto3.dynamodb.conditions import Attr

BATCH_SIZE = 20

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

def lambda_handler(event, context):
    """EventBridge triggered batch processor - adds messages to SQS queue for opted-in users"""
    return process_batch()

def generate_session_id(email):
    """
    ENHANCEMENT: Generate a session ID that's 33+ characters as required by AgentCore
    
    AgentCore requires session IDs to be at least 33 characters long for proper tracking.
    This function creates unique, deterministic session IDs for batch processing.
    """
    # Create a unique session ID using email and UUID
    base_id = f"batch_{email.replace('@', '_').replace('.', '_')}"
    unique_suffix = str(uuid.uuid4()).replace('-', '')
    session_id = f"{base_id}_{unique_suffix}"
    
    # Ensure it's at least 33 characters (AgentCore requirement)
    if len(session_id) < 33:
        session_id += 'x' * (33 - len(session_id))
    
    return session_id

def process_batch():
    table_name = os.environ.get('STUDENT_PROFILE_TABLE_NAME')
    queue_url = os.environ.get('SQS_QUEUE_URL')
    
    if not table_name or not queue_url:
        error_msg = "Missing required environment variables: STUDENT_PROFILE_TABLE_NAME or SQS_QUEUE_URL"
        print(error_msg)
        return {
            'statusCode': 500,
            'body': json.dumps(f'Configuration error: {error_msg}')
        }
    
    table = dynamodb.Table(table_name)
    
    try:
        print(f"Scanning table {table_name} for opted-in users...")
        
        # Scan table for users with optInStatus = True
        response = table.scan(
            FilterExpression=Attr('optInStatus').eq(True)
        )
        
        print(f"Found {len(response['Items'])} opted-in users")
        
        messages = []
        for item in response['Items']:
            action_id = item.get('actionID')
            email = item.get('email')
            
            # This data is passed to the SQS processor and then to AgentCore for better job recommendations
            user_profile = {
                'fullName': item.get('fullName', ''),
                'location': item.get('location', ''),
                'headline': item.get('headline', ''),
                'preferredJobRole': item.get('preferredJobRole', ''),
                'education': item.get('education', ''),
                'experience': item.get('experience', ''),
            }
            
            if email and '@' in email:
                # Generate proper session ID for AgentCore
                session_id = generate_session_id(email)
                
                messages.append({
                    'Id': str(len(messages)),
                    'MessageBody': json.dumps({
                        'email': email,
                        'action_id': action_id,
                        'session_id': session_id,
                        'user_profile': user_profile,  # Include full user profile for better job matching
                        'source': 'batch'  # Important: indicates this is batch processing
                    })
                })
                print(f"Added user {email} to batch queue with session {session_id} and profile data")
        
        if not messages:
            print("No opted-in users found to process")
            return {
                'statusCode': 200,
                'body': json.dumps('No opted-in users found to process')
            }
        
        # Send messages in batches with failure checking
        count = 0
        failed_count = 0
        
        for i in range(0, len(messages), BATCH_SIZE):
            batch = messages[i:i+BATCH_SIZE]
            print(f"Sending batch {i//BATCH_SIZE + 1} with {len(batch)} messages")
            
            sqs_response = sqs.send_message_batch(
                QueueUrl=queue_url,
                Entries=batch
            )
            
            # Check for failed messages
            if 'Failed' in sqs_response and sqs_response['Failed']:
                for failed in sqs_response['Failed']:
                    failed_count += 1
                    print(f"Failed to send message {failed['Id']}: {failed['Message']}")
            
            if 'Successful' in sqs_response:
                count += len(sqs_response['Successful'])
        
        result_msg = f'Successfully sent {count} messages to SQS'
        if failed_count > 0:
            result_msg += f', {failed_count} failed'
            
        print(result_msg)
        
        return {
            'statusCode': 200,
            'body': json.dumps(result_msg)
        }
        
    except Exception as e:
        error_msg = f"Error in batch processing: {str(e)}"
        print(error_msg)
        return {
            'statusCode': 500,
            'body': json.dumps(error_msg)
        }


