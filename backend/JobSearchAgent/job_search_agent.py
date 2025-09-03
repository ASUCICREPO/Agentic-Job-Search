# This is the old job search agent that uses the Strands Agents SDK with built-in retrieve function tooling.
# It is no longer being used and is here for reference only for a few days till the new agent is fully developed.


# #!/usr/bin/env python3
# """
# Job Search Agent using Strands with built-in retrieve function tooling.
# This agent helps users find relevant job opportunities by querying knowledge bases.
# """

# import json
# import os
# from typing import Any, Dict, Optional
# from bedrock_agentcore.memory import MemoryClient

# from strands import Agent, tool
# from strands_tools import retrieve
# from strands_tools.agent_core_memory import AgentCoreMemoryToolProvider
# from bedrock_agentcore.runtime import BedrockAgentCoreApp

# from tools import get_student_profile, save_student_profile, sanitize_email_for_actor_id

# # Environment Variables
# AWS_REGION = os.getenv('AWS_REGION')
# AGENTCORE_MEMORY_ID = os.getenv('AGENTCORE_MEMORY_ID')
# AGENTCORE_USER_PREFERENCE_STRATEGY_ID = os.getenv('AGENTCORE_USER_PREFERENCE_STRATEGY_ID')
# AGENTCORE_SUMMARY_STRATEGY_ID = os.getenv('AGENTCORE_SUMMARY_STRATEGY_ID')
# JOB_SEARCH_KB = os.getenv('JOB_SEARCH_KB') # Job search knowledge base ID - agent should use this for retrieve tool calls
# CARRIER_RESOURCE_KB = os.getenv('CARRIER_RESOURCE_KB')  # Carrier resource knowledge base ID for additional resources

# class JobSearchAgent:
#     """
#     Career Job Search Agent that uses retrieve function tooling to search knowledge bases.
#     Enhanced with resume context support for personalized job recommendations.
#     Supports session-based conversation management for maintaining context across interactions.
#     """
    
#     # Class-level dictionary to store agents by session_id
#     _session_agents: Dict[str, Agent] = {}

#     def __init__(self, session_id: Optional[str] = None, email: Optional[str] = None):
#         """
#         Initialize JobSearchAgent with optional session management and email-based actor identification.

#         Args:
#             session_id: Optional session identifier for conversation continuity.
#                        If provided, conversation history will be maintained across calls.
#                        If None, creates a stateless agent for single interactions.
#             email: User's email address used as actor_id for memory tracking.
#                   If provided, will be used for memory event tracking.
#         """
#         self.session_id = session_id
#         self.email = email
#         self.memory_client = MemoryClient(region_name=AWS_REGION)
#         self.memory_id = AGENTCORE_MEMORY_ID

#         # Create sanitized actor_id once and use it globally
#         if email:
#             self.actor_id = sanitize_email_for_actor_id(email)
#         elif session_id:
#             self.actor_id = f"user_{session_id}"
#         else:
#             self.actor_id = None

#         # Initialize memory provider for long-term memory
#         self.memory_provider = None
#         if self.memory_id and self.actor_id:
#             # Use the same sanitized actor_id for namespace consistency
#             namespace = f"/strategies/{AGENTCORE_USER_PREFERENCE_STRATEGY_ID}/actors/{self.actor_id}"

#             self.memory_provider = AgentCoreMemoryToolProvider(
#                 memory_id=self.memory_id,
#                 actor_id=self.actor_id,
#                 session_id=self.session_id,
#                 namespace=namespace,
#                 region=AWS_REGION
#             )

#         if session_id:
#             # Use or create session-specific agent
#             if session_id not in self._session_agents:
#                 self._session_agents[session_id] = self._create_agent()
#             self.agent = self._session_agents[session_id]
#         else:
#             # Create a new stateless agent for single-use
#             self.agent = self._create_agent()
    
#     def _create_agent(self) -> Agent:
#         """Create a new Agent instance with long-term memory support."""
#         # Combine all available tools
#         tools = [retrieve, save_student_profile, get_student_profile]

#         # Add memory provider tools if available
#         if self.memory_provider:
#             tools.extend(self.memory_provider.tools)

#         return Agent(
#             tools=tools,
#             system_prompt=(
#                 "You are a Career Job Search Agent specializing in three groups:\n"
#                 "• Entry-level & Internships: Recent graduates, students seeking internships\n"
#                 "• Career Transition: Professionals switching industries/roles\n"
#                 "• Part-time/School: Students balancing work and studies\n\n"
#                 "RESUME ANALYSIS WORKFLOW:\n"
#                 "Resume upload is optional - it's completely fine if user doesn't have a resume!\n"
#                 "When user uploads resume (attachment icon 📎):\n"
#                 "• Extract keywords: skills, technologies, experience level, industries\n"
#                 "• Analyze skill level: entry-level, mid-level, senior, executive\n"
#                 "• Identify career trajectory: growth patterns, role transitions\n"
#                 "• Generate targeted job searches based on resume content\n"
#                 "If no resume: Ask user directly about their skills, experience, and preferences\n\n"
#                 "Available Tools:\n"
#                 "• retrieve: Search job postings using resume keywords and skill analysis\n"
#                 f"  - ALWAYS use knowledgeBaseId parameter: '{JOB_SEARCH_KB}' \n"
#                 "• get_student_profile: Check if user has existing profile and notification preferences\n"
#                 "• save_student_profile: Store email and notification preferences (opt-in status, method: email/phone/both)\n"
#                 "• Memory tools: Access conversation history and previous preferences\n\n"
#                 "Intelligent Workflow:\n"
#                 "1) Assess Context: Check memory for existing preferences and conversation history\n"
#                 "2) Resume: If no resume uploaded, encourage upload for personalized matching\n"
#                 "   a. Analyze Resume: Extract skills, experience level, and job preferences from resume\n"
#                 "3) Smart Questions: Ask only what you need to know based on resume analysis\n"
#                 "4) Job Search: Use resume insights to find highly relevant job matches\n"
#                 "5) Value Demo: Show targeted results that align with user's background\n"
#                 "6) Daily Setup: When user agrees to daily recommendations, use save_student_profile to:\n"
#                 "   a. Store their email and notification preferences\n"
#                 "   b. Set opt_in_status=true and choose notification method (email/phone/both)\n"
#                 "   Note: Job preferences are stored separately in the memory\n\n"
#                 "User Types:\n"
#                 "• Resume-Driven: Use uploaded resume to infer preferences and skill level\n"
#                 "• No Resume: Ask directly about skills, experience, and preferences - this is perfectly fine!\n"
#                 "• Returning Users: Reference stored preferences and resume analysis if available\n"
#                 "• All Users: Provide excellent job matching regardless of resume availability\n\n"
#                 "Style: Concise, bullet-point results, official links, recent jobs only.\n"
#                 "Let resume content guide your understanding and recommendations."
#             )
#         )

#     def _create_memory_event(self, role: str, content: str):
#         """
#         Create memory event in Bedrock AgentCore for conversation tracking.

#         Args:
#             role: Message role ('USER', 'ASSISTANT', 'TOOL')
#             content: Message content
#         """
#         if not self.memory_id or not self.actor_id:
#             return

#         print(f"Creating memory event - Actor ID: {self.actor_id}, Session ID: {self.session_id}")

#         try:
#             self.memory_client.create_event(
#                 memory_id=self.memory_id,
#                 actor_id=self.actor_id,
#                 session_id=self.session_id,
#                 messages=[(content, role)]
#             )
#         except Exception as e:
#             print(f"Failed to create memory event: {e}")

# async def handle_agent_request(payload):
#     """
#     Handle agent request from AWS Bedrock Agent Runtime with session support.
    
#     Expected payload format:
#     {
#         "prompt": "Find me software engineering jobs in the Bay Area",
#         "resume_text": "John Doe\nSoftware Engineer...",  # optional
#         "session_id": "user123_session456"  # optional - enables conversation continuity
#     }
    
#     Args:
#         payload: Request payload from AWS Bedrock Agent Runtime
        
#     Yields:
#         Streaming response chunks from the agent
#     """
#     # Parse payload if it's a string
#     if isinstance(payload, str):
#         try:
#             payload = json.loads(payload)
#         except json.JSONDecodeError:
#             # If it's just a plain text prompt
#             payload = {"prompt": payload}
    
#     # Extract components from payload
#     prompt = payload.get("prompt")
#     resume_text = payload.get("resume_text")
#     session_id = payload.get("session_id")
#     email = payload.get("email")  # Email will be used directly as the action_id
    
#     if not prompt:
#         yield {"error": "Error: 'prompt' is required."}
#         return
    
#     try:
#         # Create agent with session and/or email
#         agent = JobSearchAgent(session_id=session_id, email=email)

#         # Inform the user about session and email if available
#         if session_id:
#             session_info = f"[Session ID: {session_id}"
#             if email:
#                 session_info += f" | Email: {email}]"
#             else:
#                 session_info += "]"
#             prompt = f"{session_info}\n{prompt}"

#         # Create memory event for user message
#         agent._create_memory_event("USER", prompt)

#         # Add resume to prompt if provided
#         if resume_text:
#             prompt += f"\n\nUsers Resume: {resume_text}"

#         # Stream the response with clean, useful events
#         final_response = ""
#         async for event in agent.agent.stream_async(prompt):
#             # Real-time text generation (thinking process)
#             if "data" in event:
#                 yield {"thinking": event["data"]}

#             # Complete formatted responses
#             elif "message" in event and isinstance(event["message"], dict):
#                 if "content" in event["message"]:
#                     for content in event["message"]["content"]:
#                         if "text" in content:
#                             yield {"response": content["text"]}
#                             # Keep track of the final complete response
#                             final_response = content["text"]

#             # Tool usage information - show the streaming tool input being built
#             elif "current_tool_use" in event:
#                 tool_info = event["current_tool_use"]
#                 if "name" in tool_info:
#                     tool_data = {"tool_name": tool_info["name"]}
#                     if "input" in tool_info:
#                         tool_data["tool_input"] = tool_info["input"]
#                     yield tool_data

#             # Error events
#             elif "error" in event:
#                 yield {"error": event["error"]}

#         # Yield the final complete response at the end
#         if final_response:
#             # Create memory event for assistant response
#             agent._create_memory_event("ASSISTANT", final_response)
#             yield {"final_result": final_response}
            
#     except Exception as e:
#         error_msg = f"Error processing request: {str(e)}"
#         print(error_msg)
#         yield {"error": error_msg}

# app = BedrockAgentCoreApp()

# @app.entrypoint
# async def invoke(payload: Dict[str, Any]):
#     """
#     AgentCore streaming entrypoint for Bedrock Agent Core deployment.
    
#     This is the entry point that AgentCore calls when the agent is invoked.
    
#     Args:
#         payload: Request payload containing prompt and optional parameters
        
#     Yields:
#         Streaming response chunks from the agent
#     """
#     async for event in handle_agent_request(payload):
#         yield event

# if __name__ == "__main__":
# 	app.run()