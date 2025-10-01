import json
import boto3
from botocore.config import Config
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
    
    # Initialize Bedrock AgentCore client with extended timeout
    # Batch processing can take 5-10 minutes for complex profiles with multiple job roles
    config = Config(
        read_timeout=900,  # 15 minutes to match Lambda timeout
        connect_timeout=10
    )
    client = boto3.client('bedrock-agentcore', config=config)
    
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
            
            # CORRECT: Process AgentCore SSE (Server-Sent Events) format: "data: {json}\n\n"
            response_stream = response['response']
            job_agent_result = None
            buffer = ''

            try:
                # Read streaming response and process SSE format
                for chunk in response_stream:
                    if chunk:
                        chunk_data = chunk.decode('utf-8') if isinstance(chunk, bytes) else str(chunk)
                        buffer += chunk_data

                        # Process complete lines from the buffer
                        lines = buffer.split('\n')
                        buffer = lines.pop() or ''  # Keep incomplete line in buffer

                        for line in lines:
                            line = line.strip()
                            if line.startswith('data: '):
                                try:
                                    # Parse JSON from after "data: "
                                    event = json.loads(line[6:])  # Remove "data: " prefix
                                    print(f"AgentCore event for {email}: {event}")

                                    # Look for job_agent_result event
                                    if "job_agent_result" in event:
                                        job_agent_result = event["job_agent_result"]
                                        print(f"Found job_agent_result for {email}: {job_agent_result}")
                                        break  # We got what we need

                                except json.JSONDecodeError as json_err:
                                    print(f"JSON decode error for line: {line} - {json_err}")
                                    continue

                        if job_agent_result:
                            break  # Exit outer loop if we found the result

            except Exception as stream_err:
                print(f"Error reading AgentCore stream for {email}: {stream_err}")
                # No fallback - if streaming fails, mark as failure

            # Check the job_agent_result for success/failure
            if job_agent_result:
                result_lower = job_agent_result.lower()
                if "error" in result_lower or "failed" in result_lower:
                    print(f"AgentCore returned error for {email}: {job_agent_result}")
                    failed_count += 1
                else:
                    print(f"Successfully processed job search for {email}: {job_agent_result}")
                    processed_count += 1
            else:
                failed_count += 1
                print(f"No job_agent_result found for {email}")
            
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