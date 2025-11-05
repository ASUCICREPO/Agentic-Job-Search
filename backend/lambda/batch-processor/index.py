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

# Comprehensive validation functions for DynamoDB security
def validate_email(email: str) -> str:
    """Validate email format and prevent injection"""
    if not email or not isinstance(email, str):
        raise ValueError("Email is required and must be a string")
    email = email.strip()
    if '@' not in email or '.' not in email.split('@')[1]:
        raise ValueError("Invalid email format")
    if len(email) < 5 or len(email) > 254:
        raise ValueError("Email length must be between 5 and 254 characters")
    allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@.-_+')
    if not all(c in allowed_chars for c in email):
        raise ValueError("Email contains invalid characters")
    return email.lower()

def validate_string(value: str, field_name: str, min_len: int = 0, max_len: int = 500) -> str:
    """Validate and sanitize string fields"""
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    value = value.strip()
    if len(value) < min_len or len(value) > max_len:
        raise ValueError(f"{field_name} must be between {min_len} and {max_len} characters")
    value = value.replace('<', '').replace('>', '').replace('&lt;', '').replace('&gt;', '')
    value = value.replace('\x00', '')
    return value

def validate_boolean(value: any, field_name: str) -> bool:
    """Validate boolean values"""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() in ['true', '1', 'yes']:
            return True
        if value.lower() in ['false', '0', 'no']:
            return False
    raise ValueError(f"{field_name} must be a boolean value")

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

            # VALIDATE and sanitize user profile data before processing
            try:
                # Validate email first
                validated_email = validate_email(email) if email else None

                # Validate opt-in status
                opt_in_status = validate_boolean(item.get('optInStatus', False), 'optInStatus')

                # Only process if valid email and opted in
                if not validated_email or not opt_in_status:
                    print(f"Skipping invalid user: email={email}, opt_in={opt_in_status}")
                    continue

                # Validate and sanitize profile fields
                user_profile = {
                    'fullName': validate_string(item.get('fullName', ''), 'fullName', 0, 100),
                    'location': validate_string(item.get('location', ''), 'location', 0, 100),
                    'headline': validate_string(item.get('headline', ''), 'headline', 0, 200),
                    'preferredJobRole': validate_string(item.get('preferredJobRole', ''), 'preferredJobRole', 0, 200),
                    'education': validate_string(item.get('education', ''), 'education', 0, 500),
                    'experience': validate_string(item.get('experience', ''), 'experience', 0, 2000),
                }

            except ValueError as e:
                print(f"Validation error for user {email}: {str(e)} - skipping")
                continue

            if validated_email:
                # Generate proper session ID for AgentCore
                session_id = generate_session_id(validated_email)

                messages.append({
                    'Id': str(len(messages)),
                    'MessageBody': json.dumps({
                        'email': validated_email,           # Validated
                        'action_id': action_id,            # From database 
                        'session_id': session_id,          # System-generated
                        'user_profile': user_profile,      # Validated
                        'source': 'batch'                  # Hardcoded
                    })
                })
                print(f"Added user {validated_email} to batch queue with session {session_id} and validated profile data")
        
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


