"""
ENHANCED SQS PROCESSOR LAMBDA
=============================
This Lambda function processes SQS messages from the batch processor and invokes AgentCore for job search.

Key Enhancements Made:
1. Fixed AgentCore response parsing (handles streaming responses correctly)
2. Added comprehensive user profile data to job search prompts
3. Improved error handling and logging
4. Enhanced AgentCore invocation with proper runtime ARN
5. Added detailed logging for debugging and monitoring

Workflow:
1. Receives SQS messages with user profile data from batch processor
2. Creates personalized job search prompts using user profile information
3. Invokes Bedrock AgentCore with enhanced prompts
4. Handles streaming responses from AgentCore
5. Logs results for monitoring and debugging
"""

import json
import boto3
import os
import time

def lambda_handler(event, context):
    """SQS triggered processor - processes individual job notification requests using Bedrock AgentCore"""
    
    # Get environment variables
    runtime_arn = os.environ.get('BEDROCK_AGENTCORE_RUNTIME_ARN')
    qualifier = os.environ.get('BEDROCK_AGENTCORE_QUALIFIER', 'DEFAULT')
    
    if not runtime_arn:
        print("ERROR: BEDROCK_AGENTCORE_RUNTIME_ARN environment variable not set")
        raise ValueError("Missing BEDROCK_AGENTCORE_RUNTIME_ARN configuration")
    
    # Initialize Bedrock AgentCore client
    client = boto3.client('bedrock-agentcore')
    
    processed_count = 0
    failed_count = 0
    
    for record in event['Records']:
        try:
            message = json.loads(record['body'])
            email = message.get('email')
            session_id = message.get('session_id')
            user_profile = message.get('user_profile', {})
            source = message.get('source', 'batch')
            
            print(f"Processing job search request for {email} with session {session_id}")
            print(f"User profile data: {user_profile}")
            
            if not email or '@' not in email:
                print(f"Invalid email: {email}")
                continue
                
            if not session_id or len(session_id) < 33:
                print(f"Invalid session ID (must be 33+ chars): {session_id}")
                continue
            
            # ENHANCEMENT: Create enhanced batch job search prompt with comprehensive user profile data
            # This personalized prompt helps AgentCore find more relevant job matches
            batch_prompt = f"""Find personalized job opportunities for daily batch processing.
            
User Details:
- Email: {email}
- Full Name: {user_profile.get('fullName', 'Not provided')}
- Location: {user_profile.get('location', 'Not specified')}
- Preferred Job Role: {user_profile.get('preferredJobRole', 'Not specified')}
- Headline/Title: {user_profile.get('headline', 'Not provided')}
- Education: {user_profile.get('education', 'Not provided')}
- Experience: {user_profile.get('experience', 'Not provided')}
- Processing Type: {source}

Task: Search for relevant job opportunities based on the user's detailed profile above. This is for daily job recommendations that will be saved to the database for later notification delivery.

Please find jobs that match:
1. User's preferred job role: {user_profile.get('preferredJobRole', 'any suitable role')}
2. User's location preferences: {user_profile.get('location', 'flexible location')}
3. User's experience level and background from their profile
4. User's education and skills mentioned in their profile
5. Current market opportunities that align with their career goals

Focus on quality matches that would be valuable for daily notifications. Use the user's specific profile information to find the most relevant opportunities."""

            # Prepare payload for AgentCore
            payload = json.dumps({
                "prompt": batch_prompt,
                "email": email,
                "session_id": session_id,
                "source": source
            })
            
            print(f"Invoking AgentCore for {email}...")
            print(f"Runtime ARN: {runtime_arn}")
            print(f"Session ID: {session_id}")
            print(f"Payload length: {len(payload)} characters")
            
            # ENHANCEMENT: Invoke Bedrock AgentCore with proper runtime ARN
            # Changed from regular Bedrock Agent to AgentCore for better integration
            response = client.invoke_agent_runtime(
                agentRuntimeArn=runtime_arn,
                runtimeSessionId=session_id,
                payload=payload,
                qualifier=qualifier
            )
            
            # ENHANCEMENT: Process the streaming response from AgentCore
            # AgentCore returns streaming data that needs to be handled properly
            response_stream = response['response']
            full_response = ""
            
            try:
                # Read the streaming response chunk by chunk
                for chunk in response_stream:
                    if chunk:
                        chunk_data = chunk.decode('utf-8') if isinstance(chunk, bytes) else str(chunk)
                        full_response += chunk_data
                
                print(f"AgentCore raw response for {email}: {full_response[:500]}...")  # First 500 chars
                
                # Try to parse as JSON if it looks like JSON
                if full_response.strip().startswith('{') or full_response.strip().startswith('['):
                    try:
                        response_data = json.loads(full_response)
                        print(f"AgentCore parsed JSON response for {email}: {type(response_data)}")
                    except json.JSONDecodeError as json_err:
                        print(f"JSON parsing failed for {email}, treating as text: {json_err}")
                        response_data = {"text_response": full_response}
                else:
                    # Treat as plain text response
                    response_data = {"text_response": full_response}
                    print(f"AgentCore text response for {email}: Success")
                
            except Exception as stream_err:
                print(f"Error reading AgentCore stream for {email}: {stream_err}")
                # Fallback: try to read as bytes
                try:
                    response_body = response['response'].read()
                    if isinstance(response_body, bytes):
                        full_response = response_body.decode('utf-8')
                    else:
                        full_response = str(response_body)
                    
                    print(f"AgentCore fallback response for {email}: {full_response[:200]}...")
                    response_data = {"text_response": full_response}
                    
                except Exception as fallback_err:
                    print(f"Fallback parsing also failed for {email}: {fallback_err}")
                    response_data = {"error": "Failed to parse AgentCore response", "raw_error": str(fallback_err)}
            
            # Check if the response indicates successful job processing
            if response_data:
                if isinstance(response_data, dict):
                    if "error" in response_data:
                        print(f"AgentCore returned error for {email}: {response_data['error']}")
                        failed_count += 1
                    else:
                        processed_count += 1
                        print(f"Successfully processed job search for {email}")
                        
                        # Log if we got job results
                        if "job_agent_result" in response_data or "final_result" in response_data:
                            print(f"Job recommendations generated for {email}")
                        elif "text_response" in response_data and len(response_data["text_response"]) > 50:
                            print(f"Text response received for {email} (length: {len(response_data['text_response'])})")
                else:
                    processed_count += 1
                    print(f"Successfully processed job search for {email} (non-dict response)")
            else:
                failed_count += 1
                print(f"Empty response from AgentCore for {email}")
            
            # Add small delay to avoid overwhelming the service
            time.sleep(0.1)
                
        except Exception as e:
            failed_count += 1
            error_msg = f"Error processing SQS message for {message.get('email', 'unknown')}: {str(e)}"
            print(error_msg)
            
            # For batch processing, we don't want to fail the entire batch
            # Log the error but continue processing other messages
            continue
    
    result_msg = f"Processed {processed_count} job searches, {failed_count} failed"
    print(result_msg)
    
    return {
        'statusCode': 200,
        'body': json.dumps(result_msg)
    }