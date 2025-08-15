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


def create_agent_runtime(client, agent_runtime_name: str, container_uri: str, role_arn: str, knowledge_base_id: str, aws_region: str, context):
    """Create an agent runtime"""
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
    
    # Extract ARN and ID from response for logging
    agent_runtime_id = response.get('agentRuntimeId')
    agent_runtime_arn = response.get('agentRuntimeArn')
    
    logger.info(f"Agent runtime created - ARN: {agent_runtime_arn}, ID: {agent_runtime_id}")

def update_agent_runtime(client, agent_runtime_name: str, container_uri: str, role_arn: str, knowledge_base_id: str, aws_region: str, context):
    """Update an existing agent runtime using the update API"""
    logger.info(f"Updating agent runtime: {agent_runtime_name}")
    
    try:
        # Find the agent runtime ID first
        logger.info("Finding agent runtime ID for update")
        list_response = client.list_agent_runtimes()
        
        agent_runtime_id = None
        for runtime in list_response.get('agentRuntimes', []):
            runtime_name = runtime.get('agentRuntimeName', '')
            runtime_id = runtime.get('agentRuntimeId', '')
            
            if runtime_name == agent_runtime_name or runtime_id.startswith(agent_runtime_name):
                agent_runtime_id = runtime_id
                logger.info(f"Found runtime ID for update: {agent_runtime_id}")
                break
        
        if not agent_runtime_id:
            logger.info(f"Agent runtime {agent_runtime_name} not found for update, will create new one instead")
            # Fall back to creating a new runtime
            create_agent_runtime(client, agent_runtime_name, container_uri, role_arn, knowledge_base_id, aws_region, context)
            return
        
        # Prepare environment variables
        agent_env_vars = {
            'KNOWLEDGE_BASE_ID': knowledge_base_id,
            'AWS_REGION': aws_region
        }
        
        # Call update_agent_runtime API
        logger.info(f"Calling update_agent_runtime for ID: {agent_runtime_id}")
        update_response = client.update_agent_runtime(
            agentRuntimeId=agent_runtime_id,
            agentRuntimeArtifact={
                'containerConfiguration': {
                    'containerUri': container_uri
                }
            },
            roleArn=role_arn,
            networkConfiguration={"networkMode": "PUBLIC"},
            environmentVariables=agent_env_vars
        )
        
        logger.info(f"Update agent runtime API response: {update_response}")
        
        # Extract updated information for logging
        updated_arn = update_response.get('agentRuntimeArn')
        updated_version = update_response.get('agentRuntimeVersion')
        updated_status = update_response.get('status')
        
        logger.info(f"Agent runtime updated successfully - ARN: {updated_arn}, Version: {updated_version}, Status: {updated_status}")
        
    except Exception as update_error:
        error_message = str(update_error)
        logger.error(f"Error updating agent runtime: {error_message}")
        # Re-raise the exception so the caller can handle it
        raise

def delete_agent_runtime(client, agent_runtime_name: str, context):
    """Delete an agent runtime by finding it and using its ID"""
    logger.info(f"Deleting agent runtime: {agent_runtime_name}")
    
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
            return
        
        # Attempt to delete the agent runtime using the ID
        logger.info(f"Attempting to delete agent runtime with ID: {agent_runtime_id}")
        delete_response = client.delete_agent_runtime(agentRuntimeId=agent_runtime_id)
        logger.info(f"Delete agent runtime API response: {delete_response}")
        
        logger.info(f"Agent runtime {agent_runtime_name} (ID: {agent_runtime_id}) deletion initiated")
        
    except Exception as delete_error:
        error_message = str(delete_error)
        logger.error(f"Error deleting agent runtime: {error_message}")
        # Don't fail delete operations - just log the error


def configure_xray_trace_destination():
    """Configure X-Ray to use CloudWatch Logs as trace destination for OTLP support"""
    logger.info("Configuring X-Ray trace destination")
    
    try:
        xray_client = boto3.client('xray')
        
        # First check current destination
        try:
            current_response = xray_client.get_trace_segment_destination()
            current_destination = current_response.get('Destination', 'XRay')
            current_status = current_response.get('Status', 'UNKNOWN')
            
            logger.info(f"Current X-Ray destination: {current_destination}, Status: {current_status}")
            
            # If already set to CloudWatchLogs and active, no need to update
            if current_destination == 'CloudWatchLogs' and current_status == 'ACTIVE':
                logger.info("X-Ray already configured correctly for CloudWatchLogs")
                return
            
            # If status is PENDING, don't try to update
            if current_status == 'PENDING':
                logger.info("X-Ray update already in progress, skipping")
                return
                
        except Exception as get_error:
            logger.info(f"Could not get current destination (may not exist): {get_error}")
        
        # Update to CloudWatchLogs
        try:
            update_response = xray_client.update_trace_segment_destination(
                Destination='CloudWatchLogs'
            )
            
            new_destination = update_response.get('Destination', 'CloudWatchLogs')
            new_status = update_response.get('Status', 'PENDING')
            
            logger.info(f"X-Ray destination updated to: {new_destination}, Status: {new_status}")
            
        except Exception as update_error:
            error_msg = str(update_error)
            logger.warning(f"Failed to update X-Ray destination: {error_msg}")
            
            # If update fails due to pending status, that's okay
            if 'PENDING' in error_msg:
                logger.info("X-Ray update already in progress")
            else:
                logger.error(f"Failed to update X-Ray destination: {error_msg}")
            
    except Exception as e:
        logger.error(f"Error configuring X-Ray trace destination: {e}")


def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Custom resource Lambda function to manage Bedrock AgentCore runtime lifecycle.
    Supports Create, Update (using versioning), and Delete operations.
    Version: 2.0 - Uses update_agent_runtime API for updates
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")
    
    # Extract CloudFormation custom resource properties
    request_type = event['RequestType']
    resource_properties = event['ResourceProperties']
    
    # Get environment variables
    knowledge_base_id = os.environ.get('KNOWLEDGE_BASE_ID')
    aws_region = os.environ.get('AWS_REGION')
    
    logger.info(f"Processing {request_type} request for {event.get('LogicalResourceId')}")
    
    # Extract parameters from CDK
    agent_runtime_name = resource_properties['AgentRuntimeName']
    container_uri = resource_properties['ContainerUri']
    role_arn = resource_properties['RoleArn']
    
    # Simple response data - no attributes needed
    response_data = {}
    
    # Handle Physical Resource ID consistently to prevent replacement loops
    if request_type == 'Create':
        physical_resource_id = f"agent-runtime-{agent_runtime_name}-stable"
        logger.info(f"Create operation - using stable physical resource ID: {physical_resource_id}")
    else:
        physical_resource_id = event.get('PhysicalResourceId', f"agent-runtime-{agent_runtime_name}-stable")
        logger.info(f"Update/Delete operation - using existing physical resource ID: {physical_resource_id}")
    
    try:
        # Create Bedrock AgentCore client
        client = boto3.client('bedrock-agentcore-control')
        
        if request_type == 'Create':
            try:
                # Create agent runtime
                create_agent_runtime(client, agent_runtime_name, container_uri, role_arn, knowledge_base_id, aws_region, context)
                logger.info(f"Agent runtime created successfully")
                
                # Configure X-Ray trace destination
                configure_xray_trace_destination()
                logger.info("X-Ray trace destination configured")
                    
            except Exception as create_error:
                logger.error(f"Failed to create agent runtime: {create_error}")
                send_response(event, context, 'FAILED', {'Error': str(create_error)}, physical_resource_id)
                return {'statusCode': 500, 'body': json.dumps({'Error': str(create_error)})}
                
        elif request_type == 'Update':
            logger.info(f"Update requested for agent runtime: {agent_runtime_name}")
            try:
                update_agent_runtime(client, agent_runtime_name, container_uri, role_arn, knowledge_base_id, aws_region, context)
                logger.info("Update completed successfully")
            except Exception as update_error:
                logger.error(f"Failed to update agent runtime: {update_error}")
                send_response(event, context, 'FAILED', {'Error': str(update_error)}, physical_resource_id)
                return {'statusCode': 500, 'body': json.dumps({'Error': str(update_error)})}
            
        elif request_type == 'Delete':
            try:
                delete_agent_runtime(client, agent_runtime_name, context)
                logger.info("Agent runtime deletion initiated")
            except Exception as delete_error:
                logger.error(f"Failed to delete agent runtime: {delete_error}")
                # Don't fail delete operations - just log the error
                pass
        
        # Send success response to CloudFormation
        send_response(event, context, 'SUCCESS', response_data, physical_resource_id)
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        # Send failure response to CloudFormation
        send_response(event, context, 'FAILED', {'Error': str(e)}, physical_resource_id)
    
    return {'statusCode': 200, 'body': json.dumps(response_data)}

def send_response(event: Dict[str, Any], context, response_status: str, response_data: Dict[str, Any], physical_resource_id: str):
    """Send response back to CloudFormation according to the documented format"""
    response_url = event['ResponseURL']
    
    # Build response according to CloudFormation custom resource documentation
    response_body = {
        'Status': response_status,
        'Reason': f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': physical_resource_id,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId']
    }
    
    # Only add Data if we have response_data and it's not empty
    if response_data:
        response_body['Data'] = response_data
    
    json_response_body = json.dumps(response_body)
    logger.info(f"Sending {response_status} response to CloudFormation")
    
    # Use proper headers for S3 PUT request
    headers = {
        'Content-Type': 'application/json',
        'Content-Length': str(len(json_response_body))
    }
    
    try:
        response = http.request('PUT', response_url, body=json_response_body, headers=headers)
        logger.info(f"CloudFormation response status: {response.status}")
        if response.status != 200:
            logger.error(f"CloudFormation response error: {response.data.decode('utf-8')}")
    except Exception as e:
        logger.error(f"Error sending response to CloudFormation: {e}")
        # This is critical - if we can't respond, CloudFormation will timeout
        raise
