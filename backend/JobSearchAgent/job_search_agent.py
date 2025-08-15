#!/usr/bin/env python3
"""
Job Search Agent using Strands with built-in retrieve function tooling.
This agent helps users find relevant job opportunities by querying knowledge bases.
"""

import json
from typing import Any, Dict, Optional

from strands import Agent
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands_tools import retrieve
from bedrock_agentcore.runtime import BedrockAgentCoreApp

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
            tools=[retrieve],
            conversation_manager=conversation_manager,
            system_prompt=(
                "You are a Career Job Search Agent for all fields/seniority.\n"
                "Available Tools:\n"
                "- retrieve: Query job information from Knowledge Base\n\n"
                "Resume Processing:\n"
                "When user provides resume text directly, analyze the content to understand skills, experience, education, and career trajectory.\n"
                "Use this information to craft targeted job search queries.\n\n"
                "Workflow:\n"
                "1) Resume Analysis: If resume text provided, analyze background and extract key skills/experience\n"
                "2) Company Recommendations: From resume keywords/interests, list 6–12 relevant companies (top‑tier + mission‑aligned). For each: Company — Why fit (1 line) — Careers URL.\n"
                "3) Job Search: Use retrieve function to query job information from Knowledge Base. Compose strong queries from resume skills/titles/domains and constraints. Output bullets: Title — Company — Location — Link — 1‑line rationale.\n"
                "4) Next Steps: Suggest concrete actions (tailoring, outreach/referrals, interview prep) and ask ONE precise follow‑up.\n\n"
                "Context Continuity:\n"
                "Remember previous conversations in this session. Reference earlier discussions about user's background, preferences, and job search progress.\n"
                "Build upon previous recommendations and avoid repeating the same suggestions unless specifically requested.\n\n"
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
    
    if not prompt:
        yield {"error": "Error: 'prompt' is required."}
        return
    
    try:
        # Create agent with or without session
        agent = JobSearchAgent(session_id=session_id)
        
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