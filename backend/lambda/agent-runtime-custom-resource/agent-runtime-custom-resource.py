import json
import boto3
import logging
import os
from typing import Dict, Any
import urllib3

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize HTTP client for CloudFormation responses
http = urllib3.PoolManager()

def construct_agent_runtime_arn(context, agent_runtime_name: str, agent_runtime_id: str = None) -> str:
    """Construct an agent runtime ARN using Lambda context and environment variables"""
    region = os.environ.get('AWS_REGION', 'us-east-1')
    account_id = context.invoked_function_arn.split(':')[4] if context and context.invoked_function_arn else 'unknown'
    
    # If we have the actual runtime ID, use it; otherwise use a placeholder
    runtime_identifier = agent_runtime_id if agent_runtime_id else f'{agent_runtime_name}-placeholder'
    return f'arn:aws:bedrock-agentcore:{region}:{account_id}:runtime/{runtime_identifier}'

def create_agent_runtime(client, agent_runtime_name: str, container_uri: str, role_arn: str, knowledge_base_id: str, aws_region: str, context) -> Dict[str, Any]:
    """Create an agent runtime and return response data"""
    logger.info(f"Creating agent runtime: {agent_runtime_name}")
    
    # Prepare environment variables for the agent runtime
    agent_env_vars = {
        'KNOWLEDGE_BASE_ID': knowledge_base_id,
        'AWS_REGION': aws_region
    }
    logger.info(f"Passing environment variables to agent runtime: {agent_env_vars}")
    
    # Call the CreateAgentRuntime operation
    response = client.create_agent_runtime(
        agentRuntimeName=agent_runtime_name,
        agentRuntimeArtifact={
            'containerConfiguration': {
                'containerUri': container_uri
            }
        },
        networkConfiguration={"networkMode": "PUBLIC"},
        roleArn=role_arn,
        environmentVariables=agent_env_vars
    )
    
    logger.info(f"Create agent runtime API response: {response}")
    
    # Extract ARN and ID from response
    agent_runtime_id = response.get('agentRuntimeId')
    agent_runtime_arn = response.get('agentRuntimeArn')
    
    logger.info(f"Raw response - agentRuntimeId: {agent_runtime_id}, agentRuntimeArn: {agent_runtime_arn}")
    
    response_data = {
        'AgentRuntimeArn': agent_runtime_arn or construct_agent_runtime_arn(context, agent_runtime_name, agent_runtime_id),
        'AgentRuntimeId': agent_runtime_id or agent_runtime_name,
        'Status': 'Created',
        'EnvironmentVariables': str(agent_env_vars)
    }
    
    logger.info(f"Agent runtime created - ARN: {response_data['AgentRuntimeArn']}, ID: {response_data['AgentRuntimeId']}")
    
    return response_data

def delete_agent_runtime(client, agent_runtime_name: str, context) -> Dict[str, Any]:
    """Delete an agent runtime by finding it and using its ID"""
    logger.info(f"Deleting agent runtime: {agent_runtime_name}")
    
    response_data = {
        'AgentRuntimeArn': construct_agent_runtime_arn(context, agent_runtime_name),
        'AgentRuntimeName': agent_runtime_name
    }
    
    try:
        # Find the agent runtime by listing all runtimes
        logger.info("Attempting to find agent runtime by listing all runtimes")
        list_response = client.list_agent_runtimes()
        logger.info(f"List agent runtimes response: {list_response}")
        
        # Look for a runtime that matches our agent name
        runtimes = list_response.get('agentRuntimes', [])
        agent_runtime_id = None
        
        for runtime in runtimes:
            runtime_name = runtime.get('agentRuntimeName', '')
            runtime_id = runtime.get('agentRuntimeId', '')
            logger.info(f"Found runtime - Name: {runtime_name}, ID: {runtime_id}")
            
            # Check if this runtime matches our agent name
            if runtime_name == agent_runtime_name or runtime_id.startswith(agent_runtime_name):
                agent_runtime_id = runtime_id
                logger.info(f"Found matching runtime ID: {agent_runtime_id}")
                break
        
        if agent_runtime_id is None:
            logger.info(f"No matching runtime found for name: {agent_runtime_name}")
            response_data['Status'] = 'Runtime Not Found - Assuming Already Deleted'
            response_data['Message'] = f'No runtime found with name {agent_runtime_name}, assuming already deleted'
            return response_data
        
        # Attempt to delete the agent runtime using the ID
        logger.info(f"Attempting to delete agent runtime with ID: {agent_runtime_id}")
        delete_response = client.delete_agent_runtime(agentRuntimeId=agent_runtime_id)
        logger.info(f"Delete agent runtime API response: {delete_response}")
        
        response_data['Status'] = 'Deleted'
        response_data['Message'] = f'Agent runtime {agent_runtime_name} (ID: {agent_runtime_id}) deletion initiated'
        
    except Exception as delete_error:
        error_message = str(delete_error)
        logger.error(f"Error deleting agent runtime: {error_message}")
        
        # Check if it's a "not found" error, which is acceptable for delete operations
        if 'ResourceNotFoundException' in error_message or 'not found' in error_message.lower():
            logger.info(f"Agent runtime {agent_runtime_name} was already deleted or never existed")
            response_data['Status'] = 'Already Deleted'
            response_data['Message'] = f'Agent runtime {agent_runtime_name} was already deleted or never existed'
        else:
            # For other errors, we should still report success to avoid CloudFormation getting stuck
            logger.warning(f"Delete operation encountered error but will report success to avoid stack deletion issues: {error_message}")
            response_data['Status'] = 'Delete Attempted'
            response_data['Message'] = f'Delete attempted but encountered error: {error_message}'
    
    return response_data

def wait_for_deletion(client, agent_runtime_name: str, max_wait_seconds: int = 60) -> bool:
    """Wait for agent runtime deletion to complete by checking if it no longer exists"""
    import time
    
    logger.info(f"Waiting for agent runtime {agent_runtime_name} deletion to complete (max {max_wait_seconds}s)")
    
    start_time = time.time()
    check_interval = 5  # Check every 5 seconds
    
    while time.time() - start_time < max_wait_seconds:
        try:
            # Try to list all runtimes and see if our runtime still exists
            list_response = client.list_agent_runtimes()
            runtimes = list_response.get('agentRuntimes', [])
            
            # Check if our runtime still exists
            runtime_exists = False
            for runtime in runtimes:
                runtime_name = runtime.get('agentRuntimeName', '')
                runtime_id = runtime.get('agentRuntimeId', '')
                
                if runtime_name == agent_runtime_name or runtime_id.startswith(agent_runtime_name):
                    runtime_exists = True
                    runtime_status = runtime.get('status', 'UNKNOWN')
                    logger.info(f"Runtime {agent_runtime_name} still exists with status: {runtime_status}")
                    break
            
            if not runtime_exists:
                logger.info(f"Runtime {agent_runtime_name} successfully deleted")
                return True
                
            # Wait before next check
            logger.info(f"Waiting {check_interval}s before next check...")
            time.sleep(check_interval)
            
        except Exception as check_error:
            logger.warning(f"Error checking deletion status: {check_error}")
            # Continue waiting, maybe it's a temporary error
            time.sleep(check_interval)
    
    # Timeout reached
    logger.warning(f"Timeout waiting for {agent_runtime_name} deletion after {max_wait_seconds}s")
    return False

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Custom resource Lambda function to manage Bedrock AgentCore runtime creation/deletion
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")
    
    # Log environment variables for debugging
    knowledge_base_id = os.environ.get('KNOWLEDGE_BASE_ID')
    aws_region = os.environ.get('AWS_REGION')
    logger.info(f"Environment variables - KNOWLEDGE_BASE_ID: {knowledge_base_id}, AWS_REGION: {aws_region}")
    
    # Extract CloudFormation custom resource properties
    request_type = event['RequestType']
    resource_properties = event['ResourceProperties']
    
    # Extract parameters from CDK
    agent_runtime_name = resource_properties['AgentRuntimeName']
    container_uri = resource_properties['ContainerUri']
    role_arn = resource_properties['RoleArn']
    
    response_data = {
        'AgentRuntimeArn': construct_agent_runtime_arn(context, agent_runtime_name),  # Initialize with placeholder ARN
        'AgentRuntimeName': agent_runtime_name,
        'KnowledgeBaseId': knowledge_base_id or 'Not Set',
        'Region': aws_region or 'Not Set'
    }
    # Handle Physical Resource ID consistently to prevent replacement loops
    if request_type == 'Create':
        # For Create: use stable ID
        physical_resource_id = f"agent-runtime-{agent_runtime_name}-stable"
        logger.info(f"Create operation - using stable physical resource ID: {physical_resource_id}")
    else:
        # For Update/Delete: use the existing PhysicalResourceId from CloudFormation
        physical_resource_id = event.get('PhysicalResourceId', f"agent-runtime-{agent_runtime_name}-stable")
        logger.info(f"Update/Delete operation - using existing physical resource ID: {physical_resource_id}")
    
    try:
        # Create Bedrock AgentCore client (region will be automatically detected from Lambda environment)
        client = boto3.client('bedrock-agentcore-control')
        
        if request_type == 'Create':
            try:
                create_response = create_agent_runtime(client, agent_runtime_name, container_uri, role_arn, knowledge_base_id, aws_region, context)
                response_data.update(create_response)
                logger.info(f"Using stable physical resource ID: {physical_resource_id}")
                    
            except Exception as create_error:
                logger.error(f"Failed to create agent runtime: {create_error}")
                # For create failures, we should fail the CloudFormation operation
                response_data['AgentRuntimeArn'] = construct_agent_runtime_arn(context, agent_runtime_name)
                response_data['Status'] = 'Creation Failed'
                response_data['Error'] = str(create_error)
                # Send failure response to CloudFormation
                send_response(event, context, 'FAILED', response_data, physical_resource_id)
                return {'statusCode': 500, 'body': json.dumps(response_data)}
        elif request_type == 'Update':
            logger.info(f"Update requested for agent runtime: {agent_runtime_name}")
            logger.info("Performing update by deleting existing runtime and creating new one")
            
            try:
                # Step 1: Delete existing runtime (if it exists)
                delete_response = delete_agent_runtime(client, agent_runtime_name, context)
                logger.info(f"Delete step completed: {delete_response['Status']}")
                
                # Step 2: Wait for deletion to complete before creating new one
                if delete_response['Status'] in ['Deleted', 'Already Deleted']:
                    if delete_response['Status'] == 'Deleted':
                        logger.info("Waiting for deletion to complete before creating new runtime...")
                        deletion_completed = wait_for_deletion(client, agent_runtime_name, max_wait_seconds=90)
                        
                        if not deletion_completed:
                            logger.warning("Deletion wait timed out, proceeding with creation anyway")
                            response_data['Warning'] = 'Deletion wait timed out but proceeding with creation'
                        else:
                            logger.info("Deletion confirmed complete, proceeding with creation")
                    else:
                        logger.info("Runtime was already deleted, proceeding with creation")
                    
                    # Step 3: Create new runtime with updated properties
                    create_response = create_agent_runtime(client, agent_runtime_name, container_uri, role_arn, knowledge_base_id, aws_region, context)
                    logger.info(f"Create step completed: {create_response['Status']}")
                    
                    # Use the create response data
                    response_data.update(create_response)
                    response_data['Status'] = 'Updated (Deleted and Recreated)'
                    response_data['Message'] = f'Agent runtime {agent_runtime_name} updated by deleting old runtime and creating new one'
                    response_data['DeleteStep'] = delete_response['Status']
                    response_data['CreateStep'] = create_response['Status']
                else:
                    # Delete step failed, don't proceed with creation
                    logger.error(f"Delete step failed: {delete_response['Status']}, aborting update")
                    response_data.update(delete_response)
                    response_data['Status'] = 'Update Failed - Delete Step Failed'
                    response_data['Message'] = f'Update failed because delete step failed: {delete_response.get("Message", "Unknown error")}'
                    send_response(event, context, 'FAILED', response_data, physical_resource_id)
                    return {'statusCode': 500, 'body': json.dumps(response_data)}
                
            except Exception as update_error:
                logger.error(f"Failed to update agent runtime: {update_error}")
                response_data['AgentRuntimeArn'] = construct_agent_runtime_arn(context, agent_runtime_name)
                response_data['Status'] = 'Update Failed'
                response_data['Error'] = str(update_error)
                # Send failure response to CloudFormation
                send_response(event, context, 'FAILED', response_data, physical_resource_id)
                return {'statusCode': 500, 'body': json.dumps(response_data)}
            
        elif request_type == 'Delete':
            delete_response = delete_agent_runtime(client, agent_runtime_name, context)
            response_data.update(delete_response)
        
        else:
            # Handle any unexpected request types
            logger.warning(f"Unexpected request type: {request_type}")
            response_data['AgentRuntimeArn'] = construct_agent_runtime_arn(context, agent_runtime_name)
            response_data['Status'] = f'Unexpected Request Type: {request_type}'
            response_data['Message'] = f'Received unexpected request type: {request_type}'
        
        # Ensure AgentRuntimeArn is always present before sending response
        if not response_data.get('AgentRuntimeArn'):
            response_data['AgentRuntimeArn'] = construct_agent_runtime_arn(context, agent_runtime_name)
            logger.warning("AgentRuntimeArn was missing, added constructed ARN")
        
        # Send success response to CloudFormation
        send_response(event, context, 'SUCCESS', response_data, physical_resource_id)
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        # Ensure AgentRuntimeArn is present even in failure cases
        error_response_data = {
            'Error': str(e),
            'AgentRuntimeArn': construct_agent_runtime_arn(context, agent_runtime_name),
            'AgentRuntimeName': agent_runtime_name
        }
        # Send failure response to CloudFormation
        send_response(event, context, 'FAILED', error_response_data, physical_resource_id)
    
    return {'statusCode': 200, 'body': json.dumps(response_data)}

def send_response(event: Dict[str, Any], context, response_status: str, response_data: Dict[str, Any], physical_resource_id: str):
    """
    Send response back to CloudFormation
    """
    response_url = event['ResponseURL']
    
    response_body = {
        'Status': response_status,
        'Reason': f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': physical_resource_id,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': response_data
    }
    
    json_response_body = json.dumps(response_body)
    
    headers = {
        'content-type': '',
        'content-length': str(len(json_response_body))
    }
    
    try:
        response = http.request('PUT', response_url, body=json_response_body, headers=headers)
        logger.info(f"Status code: {response.status}")
    except Exception as e:
        logger.error(f"Error sending response: {e}")
