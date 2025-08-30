#!/usr/bin/env python3
"""
Job Search Agent using Strands with built-in retrieve function tooling.
This agent helps users find relevant job opportunities by querying knowledge bases.
"""

import json
import os
import boto3
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from bedrock_agentcore.memory import MemoryClient

from strands import Agent, tool
from strands_tools import retrieve
from strands_tools.agent_core_memory import AgentCoreMemoryToolProvider
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# Environment Variables
AWS_REGION = os.getenv('AWS_REGION')
AGENTCORE_MEMORY_ID = os.getenv('AGENTCORE_MEMORY_ID')
AGENTCORE_USER_PREFERENCE_STRATEGY_ID = os.getenv('AGENTCORE_USER_PREFERENCE_STRATEGY_ID')
AGENTCORE_SUMMARY_STRATEGY_ID = os.getenv('AGENTCORE_SUMMARY_STRATEGY_ID')
KNOWLEDGE_BASE_ID = os.getenv('KNOWLEDGE_BASE_ID') # Not used anywhere but it is important for retreive tool
TABLE_NAME = os.getenv('DYNAMO_TABLE_NAME')

def sanitize_email_for_actor_id(email: str) -> str:
    """
    Global sanitization function for email to actor_id conversion.

    This function is used consistently across the entire application:
    - JobSearchAgent for actor_id creation
    - DynamoDB functions for database keys
    - Memory namespaces for AWS Bedrock compatibility

    Args:
        email: Original email address

    Returns:
        Sanitized email safe for AWS Bedrock Agent Core
    """
    if not email:
        return ""

    # Replace any character not in allowed set with underscore
    sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
    # Fix consecutive colons
    sanitized = sanitized.replace('::', ':_')

    return sanitized

class StudentProfile(BaseModel):
    """Student profile information for storing in DynamoDB."""
    email: str = Field(..., description="Student's email address")
    opt_in_status: bool = Field(..., description="Whether the student has opted in to receive notifications")
    session_id: Optional[str] = Field(None, description="Session ID for the conversation")

@tool
def get_student_profile(email: str) -> Dict[str, Any]:
    """
    Check if a student profile already exists in DynamoDB.
    
    Use this tool to retrieve student profile information based on their email address.
    This tool is useful to check if a student has already registered their email and
    notification preferences.
    
    Args:
        email: Student's email address (e.g., "student@university.edu")
    
    Returns:
        Dictionary containing the student profile information if found, or a message
        indicating the profile was not found.
    """
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)

        # Sanitize email to get the actor_id for database lookup using global function
        sanitized_actor_id = sanitize_email_for_actor_id(email)

        # Query for existing records with sanitized actor_id
        response = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Key('actionID').eq(sanitized_actor_id)
        )

        items = response.get('Items', [])

        if not items:
            return {
                "exists": False,
                "message": f"No profile found for email: {email}"
            }

        # Get the most recently added profile (highest session ID)
        # This assumes that the most recent session has the most up-to-date info
        most_recent = sorted(items, key=lambda x: x.get('sessionID', ''), reverse=True)[0]

        opt_in_status = most_recent.get('optInStatus', False)
        notification_method = most_recent.get('notificationMethod', 'email')
        stored_email = most_recent.get('email', email)  # Fallback to provided email if not stored

        return {
            "exists": True,
            "email": stored_email,
            "opt_in_status": opt_in_status,
            "notification_method": notification_method,
            "session_id": most_recent.get('sessionID', None),
            "message": "Student profile found"
        }
    except Exception as e:
        return {
            "exists": False,
            "error": True,
            "message": f"Error retrieving student profile: {str(e)}"
        }
    
@tool
def save_student_profile(email: str, opt_in_status: bool, notification_method: str = "email", session_id: Optional[str] = None, update_existing: bool = True) -> Dict[str, Any]:
    """
    Save or update student profile information in DynamoDB.

    Use this tool to store student email and notification preferences. This tool should be used when a student
    provides their email address and indicates whether they want to receive notifications about job opportunities.

    After collecting the email address from the user, use this tool to store their information.

    The tool will create a new record or update an existing one based on the sanitized email (actor_id).

    Args:
        email: Student's email address (e.g., "student@university.edu")
        opt_in_status: Whether the student has opted in to receive notifications (true/false)
        notification_method: How the student prefers to be notified - "email", "phone", or "both" (default: "email")
        session_id: Optional session ID for the current conversation (if not provided, will use a default)
        update_existing: Whether to update if a record with this email already exists (default: True)

    Returns:
        Status information about the database operation
    """
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)

        # Sanitize email to create the actor_id using global function
        sanitized_actor_id = sanitize_email_for_actor_id(email)

        current_session_id = session_id 

        # Check if this record already exists, if update_existing is False, we'll inform about it
        existing_record = False

        if update_existing:
            # Check for existing records with sanitized actor_id
            response = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Key('actionID').eq(sanitized_actor_id)
            )

            if response.get('Items', []):
                existing_record = True

        # Validate notification_method value
        valid_methods = ["email", "phone", "both"]
        validated_method = notification_method.lower() if notification_method.lower() in valid_methods else "email"

        # Prepare item for DynamoDB - using sanitized actor_id and storing original email
        item = {
            'sessionID': current_session_id,
            'actionID': sanitized_actor_id,  # Sanitized email as primary key
            'email': email,  # Original email stored separately
            'optInStatus': opt_in_status,
            'notificationMethod': validated_method
        }

        # Put item in DynamoDB
        table.put_item(Item=item)

        if existing_record:
            return {
                "success": True,
                "message": "Student profile updated successfully",
                "updated": True,
                "session_id": current_session_id,
                "actor_id": sanitized_actor_id,
                "email": email,
                "opt_in_status": opt_in_status,
                "notification_method": validated_method
            }
        else:
            return {
                "success": True,
                "message": "New student profile saved successfully",
                "updated": False,
                "session_id": current_session_id,
                "actor_id": sanitized_actor_id,
                "email": email,
                "opt_in_status": opt_in_status,
                "notification_method": validated_method
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error saving student profile: {str(e)}"
        }

class JobSearchAgent:
    """
    Career Job Search Agent that uses retrieve function tooling to search knowledge bases.
    Enhanced with resume context support for personalized job recommendations.
    Supports session-based conversation management for maintaining context across interactions.
    """
    
    # Class-level dictionary to store agents by session_id
    _session_agents: Dict[str, Agent] = {}

    def __init__(self, session_id: Optional[str] = None, email: Optional[str] = None):
        """
        Initialize JobSearchAgent with optional session management and email-based actor identification.

        Args:
            session_id: Optional session identifier for conversation continuity.
                       If provided, conversation history will be maintained across calls.
                       If None, creates a stateless agent for single interactions.
            email: User's email address used as actor_id for memory tracking.
                  If provided, will be used for memory event tracking.
        """
        self.session_id = session_id
        self.email = email
        self.memory_client = MemoryClient(region_name=AWS_REGION)
        self.memory_id = AGENTCORE_MEMORY_ID

        # Create sanitized actor_id once and use it globally
        if email:
            self.actor_id = sanitize_email_for_actor_id(email)
        elif session_id:
            self.actor_id = f"user_{session_id}"
        else:
            self.actor_id = None

        # Initialize memory provider for long-term memory
        self.memory_provider = None
        if self.memory_id and self.actor_id:
            # Use the same sanitized actor_id for namespace consistency
            namespace = f"/strategies/{AGENTCORE_USER_PREFERENCE_STRATEGY_ID}/actors/{self.actor_id}"

            self.memory_provider = AgentCoreMemoryToolProvider(
                memory_id=self.memory_id,
                actor_id=self.actor_id,
                session_id=self.session_id,
                namespace=namespace,
                region=AWS_REGION
            )

        if session_id:
            # Use or create session-specific agent
            if session_id not in self._session_agents:
                self._session_agents[session_id] = self._create_agent()
            self.agent = self._session_agents[session_id]
        else:
            # Create a new stateless agent for single-use
            self.agent = self._create_agent()
    
    def _create_agent(self) -> Agent:
        """Create a new Agent instance with long-term memory support."""
        # Combine all available tools
        tools = [retrieve, save_student_profile, get_student_profile]

        # Add memory provider tools if available
        if self.memory_provider:
            tools.extend(self.memory_provider.tools)

        return Agent(
            tools=tools,
            system_prompt=(
                "You are a Career Job Search Agent specializing in three groups:\n"
                "• Entry-level & Internships: Recent graduates, students seeking internships\n"
                "• Career Transition: Professionals switching industries/roles\n"
                "• Part-time/School: Students balancing work and studies\n\n"
                "RESUME ANALYSIS WORKFLOW:\n"
                "Resume upload is optional - it's completely fine if user doesn't have a resume!\n"
                "When user uploads resume (attachment icon 📎):\n"
                "• Extract keywords: skills, technologies, experience level, industries\n"
                "• Analyze skill level: entry-level, mid-level, senior, executive\n"
                "• Identify career trajectory: growth patterns, role transitions\n"
                "• Generate targeted job searches based on resume content\n"
                "If no resume: Ask user directly about their skills, experience, and preferences\n\n"
                "Available Tools:\n"
                "• retrieve: Search job postings using resume keywords and skill analysis\n"
                "• get_student_profile: Check if user has existing profile and notification preferences\n"
                "• save_student_profile: Store email and notification preferences (opt-in status, method: email/phone/both)\n"
                "• Memory tools: Access conversation history and previous preferences\n\n"
                "Intelligent Workflow:\n"
                "1) Assess Context: Check memory for existing preferences and conversation history\n"
                "2) Resume: If no resume uploaded, encourage upload for personalized matching\n"
                "   a. Analyze Resume: Extract skills, experience level, and job preferences from resume\n"
                "3) Smart Questions: Ask only what you need to know based on resume analysis\n"
                "4) Job Search: Use resume insights to find highly relevant job matches\n"
                "5) Value Demo: Show targeted results that align with user's background\n"
                "6) Daily Setup: When user agrees to daily recommendations, use save_student_profile to:\n"
                "   a. Store their email and notification preferences\n"
                "   b. Set opt_in_status=true and choose notification method (email/phone/both)\n"
                "   Note: Job preferences are stored separately in the memory\n\n"
                "User Types:\n"
                "• Resume-Driven: Use uploaded resume to infer preferences and skill level\n"
                "• No Resume: Ask directly about skills, experience, and preferences - this is perfectly fine!\n"
                "• Returning Users: Reference stored preferences and resume analysis if available\n"
                "• All Users: Provide excellent job matching regardless of resume availability\n\n"
                "Style: Concise, bullet-point results, official links, recent jobs only.\n"
                "Let resume content guide your understanding and recommendations."
            )
        )
    

    


    def _create_memory_event(self, role: str, content: str):
        """
        Create memory event in Bedrock AgentCore for conversation tracking.

        Args:
            role: Message role ('USER', 'ASSISTANT', 'TOOL')
            content: Message content
        """
        if not self.memory_id or not self.actor_id:
            return

        print(f"Creating memory event - Actor ID: {self.actor_id}, Session ID: {self.session_id}")

        try:
            self.memory_client.create_event(
                memory_id=self.memory_id,
                actor_id=self.actor_id,
                session_id=self.session_id,
                messages=[(content, role)]
            )
        except Exception as e:
            print(f"Failed to create memory event: {e}")

async def handle_agent_request(payload):
    """
    Handle agent request from AWS Bedrock Agent Runtime with session support.
    
    Expected payload format:
    {
        "prompt": "Find me software engineering jobs in the Bay Area",
        "resume_text": "John Doe\nSoftware Engineer...",  # optional
        "session_id": "user123_session456"  # optional - enables conversation continuity
    }
    
    Args:
        payload: Request payload from AWS Bedrock Agent Runtime
        
    Yields:
        Streaming response chunks from the agent
    """
    # Parse payload if it's a string
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            # If it's just a plain text prompt
            payload = {"prompt": payload}
    
    # Extract components from payload
    prompt = payload.get("prompt")
    resume_text = payload.get("resume_text")
    session_id = payload.get("session_id")
    email = payload.get("email")  # Email will be used directly as the action_id
    
    if not prompt:
        yield {"error": "Error: 'prompt' is required."}
        return
    
    try:
        # Create agent with session and/or email
        agent = JobSearchAgent(session_id=session_id, email=email)

        # Inform the user about session and email if available
        if session_id:
            session_info = f"[Session ID: {session_id}"
            if email:
                session_info += f" | Email: {email}]"
            else:
                session_info += "]"
            prompt = f"{session_info}\n{prompt}"

        # Create memory event for user message
        agent._create_memory_event("USER", prompt)

        # Add resume to prompt if provided
        if resume_text:
            prompt += f"\n\nUsers Resume: {resume_text}"

        # Stream the response with clean, useful events
        final_response = ""
        async for event in agent.agent.stream_async(prompt):
            # Real-time text generation (thinking process)
            if "data" in event:
                yield {"thinking": event["data"]}

            # Complete formatted responses
            elif "message" in event and isinstance(event["message"], dict):
                if "content" in event["message"]:
                    for content in event["message"]["content"]:
                        if "text" in content:
                            yield {"response": content["text"]}
                            # Keep track of the final complete response
                            final_response = content["text"]

            # Tool usage information - show the streaming tool input being built
            elif "current_tool_use" in event:
                tool_info = event["current_tool_use"]
                if "name" in tool_info:
                    tool_data = {"tool_name": tool_info["name"]}
                    if "input" in tool_info:
                        tool_data["tool_input"] = tool_info["input"]
                    yield tool_data

            # Error events
            elif "error" in event:
                yield {"error": event["error"]}

        # Yield the final complete response at the end
        if final_response:
            # Create memory event for assistant response
            agent._create_memory_event("ASSISTANT", final_response)
            yield {"final_result": final_response}
            
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        print(error_msg)
        yield {"error": error_msg}

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload: Dict[str, Any]):
    """
    AgentCore streaming entrypoint for Bedrock Agent Core deployment.
    
    This is the entry point that AgentCore calls when the agent is invoked.
    
    Args:
        payload: Request payload containing prompt and optional parameters
        
    Yields:
        Streaming response chunks from the agent
    """
    async for event in handle_agent_request(payload):
        yield event

if __name__ == "__main__":
	app.run()