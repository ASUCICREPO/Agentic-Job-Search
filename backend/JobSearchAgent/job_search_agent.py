#!/usr/bin/env python3
"""
Job Search Agent using Strands with built-in retrieve function tooling.
This agent helps users find relevant job opportunities by querying knowledge bases.
"""

import json
import os
import boto3
import inspect
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from bedrock_agentcore.memory import MemoryClient

from strands import Agent, tool
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands_tools import retrieve
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# Environment Variables
AWS_REGION = os.getenv('AWS_REGION', 'us-west-2')
AGENTCORE_MEMORY_ID = os.getenv('AGENTCORE_MEMORY_ID')
KNOWLEDGE_BASE_ID = os.getenv('KNOWLEDGE_BASE_ID') # Not used anywhere but it is important for retreive tool
TABLE_NAME = os.getenv('DYNAMO_TABLE_NAME')

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
        
        # Query for existing records with this email as action_id
        # We'll look across all session_ids since the email is used as action_id
        response = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Key('actionID').eq(email)
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
        
        return {
            "exists": True,
            "email": email,
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
    
    The tool will create a new record or update an existing one based on the email address.
    
    Args:
        email: Student's email address (e.g., "student@university.edu")
        opt_in_status: Whether the student has opted in to receive notifications (true/false)
        notification_method: How the student prefers to be notified - "email", "message", or "both" (default: "email")
        session_id: Optional session ID for the current conversation (if not provided, will use a default)
        update_existing: Whether to update if a record with this email already exists (default: True)
    
    Returns:
        Status information about the database operation
    """
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)
        
        # Use email directly as action_id since it's unique per student
        current_session_id = session_id or "default_session"
        
        # Check if this record already exists, if update_existing is False, we'll inform about it
        existing_record = False
        
        if update_existing:
            # Check for existing records with this email as action_id
            response = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Key('actionID').eq(email)
            )
            
            if response.get('Items', []):
                existing_record = True
        
        # Validate notification_method value
        valid_methods = ["email", "message", "both"]
        validated_method = notification_method.lower() if notification_method.lower() in valid_methods else "email"
        
        # Prepare item for DynamoDB - using email directly as actionID
        item = {
            'sessionID': current_session_id,
            'actionID': email,  # Email is used directly as the action_id
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
    
    def __init__(self, session_id: Optional[str] = None):
        """
        Initialize JobSearchAgent with optional session management.
        
        Args:
            session_id: Optional session identifier for conversation continuity.
                       If provided, conversation history will be maintained across calls.
                       If None, creates a stateless agent for single interactions.
        """
        self.session_id = session_id
        self.memory_client = MemoryClient(region_name=AWS_REGION)
        self.memory_id = AGENTCORE_MEMORY_ID
        
        # Create actor_id once if session_id is provided
        self.actor_id = f"user_{session_id}" if session_id else None
        
        if session_id:
            # Use or create session-specific agent
            if session_id not in self._session_agents:
                self._session_agents[session_id] = self._create_agent()
            self.agent = self._session_agents[session_id]
        else:
            # Create a new stateless agent for single-use
            self.agent = self._create_agent()
    
    def _create_agent(self) -> Agent:
        """Create a new Agent instance with conversation management."""
        # Create conversation manager with reasonable window size
        conversation_manager = SlidingWindowConversationManager(
            window_size=20  # Keep last 20 message pairs (40 total messages)
        )
        
        return Agent(
            tools=[retrieve, save_student_profile, get_student_profile],
            conversation_manager=conversation_manager,
            system_prompt=(
                "You are a Career Job Search Agent for all fields/seniority.\n"
                "Available Tools:\n"
                "- retrieve: Query job information from Knowledge Base\n"
                "- get_student_profile: Check if a student already has a profile in the database using their email address\n"
                "- save_student_profile: Save or update student profile information including email, notification method (email/message/both), and opt-in status\n\n"
                "Resume Processing:\n"
                "When user provides resume text directly, analyze the content to understand skills, experience, education, and career trajectory.\n"
                "Use this information to craft targeted job search queries.\n\n"
                "Workflow:\n"
                "1) Student Information: Ask for email and notification preferences.\n"
                "   a. Ask for the student's email address if not already provided.\n"
                "   b. Ask how they prefer to be notified about job opportunities: via email, message, or both.\n"
                "   c. Use get_student_profile to check if they already have a profile.\n"
                "   d. For existing profiles, confirm their current notification settings.\n"
                "   e. Use save_student_profile to create or update their profile with their email and notification preferences.\n"
                "   f. The student's email is used as the unique identifier in the database.\n"
                "2) Resume Analysis: If resume text provided, analyze background and extract key skills/experience\n"
                "3) Company Recommendations: From resume keywords/interests, list 6–12 relevant companies (top‑tier + mission‑aligned). For each: Company — Why fit (1 line) — Careers URL.\n"
                "4) Job Search: Use retrieve function to query job information from Knowledge Base. Compose strong queries from resume skills/titles/domains and constraints. Output bullets: Title — Company — Location — Link — 1‑line rationale.\n"
                "5) Next Steps: Suggest concrete actions (tailoring, outreach/referrals, interview prep) and ask ONE precise follow‑up.\n\n"
                "Context Continuity:\n"
                "Remember previous conversations in this session. Reference earlier discussions about user's background, preferences, and job search progress.\n"
                "Build upon previous recommendations and avoid repeating the same suggestions unless specifically requested.\n\n"
                "Student Record Handling:\n"
                "When you find an existing student record, acknowledge this with a friendly message like 'Welcome back! I see you're already registered with us.' and confirm their notification preferences (email, message, or both).\n"
                "Always use the most up-to-date preferences from the student, and be clear about the actions you're taking with their data.\n"
                "If the user wants to change their notification method, update their profile using save_student_profile with their new preference.\n\n"
                "Style: concise, bullet‑first, official links, recent postings only; group and rank best matches first.\n"
                "Tool usage: Use retrieve for job search; degrade gracefully if tools unavailable.\n"
                "Safety: No chain‑of‑thought; concise reasoning only; use only user‑provided information and resume content."
            )
        )
    
    def get_conversation_history(self) -> list:
        """
        Get the current conversation history for this session.
        
        Returns:
            List of messages in the conversation history
        """
        return self.agent.messages
    
    def clear_session(self) -> None:
        """
        Clear the conversation history for the current session.
        This removes the session from memory entirely.
        """
        if self.session_id and self.session_id in self._session_agents:
            del self._session_agents[self.session_id]
    
    @classmethod
    def clear_all_sessions(cls) -> None:
        """
        Clear all active sessions. Useful for memory management.
        """
        cls._session_agents.clear()
    
    @classmethod
    def get_active_sessions(cls) -> list:
        """
        Get list of currently active session IDs.
        
        Returns:
            List of active session IDs
        """
        return list(cls._session_agents.keys())
    
    def get_session_info(self) -> Dict[str, Any]:
        """
        Get information about the current session.
        
        Returns:
            Dictionary containing session information
        """
        return {
            "session_id": self.session_id,
            "has_history": len(self.agent.messages) > 0,
            "message_count": len(self.agent.messages),
            "agent_state": self.agent.state.get()
        }
    
    def _create_memory_event(self, role: str, content: str):
        """
        Create memory event in Bedrock AgentCore for conversation tracking.
        
        Args:
            role: Message role ('USER', 'ASSISTANT', 'TOOL')
            content: Message content
        """
        if not self.session_id or not self.memory_id:
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
        # Create agent with or without session
        agent = JobSearchAgent(session_id=session_id)
                
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
        
        # Add resume to prompt if provided - do this after any email instructions
        # so the resume doesn't interfere with the email collection flow
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
                        # No memory event for tool usage - removed
                    yield tool_data
            
            # Error events
            elif "error" in event:
                yield {"error": event["error"]}
        
        # Yield the final complete response at the end
        if final_response:
            # Create memory event for assistant response
            agent._create_memory_event("ASSISTANT", final_response)
            # No batch sync - removed
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