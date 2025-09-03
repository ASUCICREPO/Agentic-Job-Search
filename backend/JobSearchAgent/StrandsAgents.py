#!/usr/bin/env python3
"""
Strands Agents - Multi-Agent System for Job Search and Career Services
Using the "Agents as Tools" pattern with Strands Agents SDK.

This module contains three specialized agents:
1. Orchestrator Agent - Routes queries to appropriate specialized agents
2. Job Search Agent Tool - Handles job search queries with resume matching
3. Career Advice Agent Tool - Provides career development guidance
"""

import json
import os
from typing import Any, Dict, Optional
from bedrock_agentcore.memory import MemoryClient

from strands import Agent, tool
from strands_tools import retrieve
from strands_tools.agent_core_memory import AgentCoreMemoryToolProvider
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from tools import get_student_profile, save_student_profile, sanitize_email_for_actor_id

# Environment Variables
AWS_REGION = os.getenv('AWS_REGION')
AGENTCORE_MEMORY_ID = os.getenv('AGENTCORE_MEMORY_ID')
AGENTCORE_USER_PREFERENCE_STRATEGY_ID = os.getenv('AGENTCORE_USER_PREFERENCE_STRATEGY_ID')
JOB_SEARCH_KB = os.getenv('JOB_SEARCH_KB') # Job search knowledge base ID - agent should use this for retrieve tool calls
CARRIER_RESOURCE_KB = os.getenv('CARRIER_RESOURCE_KB')  # Carrier resource knowledge base ID for additional resources

# Specialized Agent Tools using the "Agents as Tools" pattern

def _get_memory_tools(session_id: str = "", email: str = ""):
    """Helper function to get memory tools for agents."""
    if not session_id and not email:
        return []

    # Create sanitized actor_id
    if email:
        actor_id = sanitize_email_for_actor_id(email)
    elif session_id:
        actor_id = f"user_{session_id}"
    else:
        return []

    # Initialize memory provider for long-term memory
    try:
        namespace = f"/strategies/{AGENTCORE_USER_PREFERENCE_STRATEGY_ID}/actors/{actor_id}"
        memory_provider = AgentCoreMemoryToolProvider(
            memory_id=AGENTCORE_MEMORY_ID,
            actor_id=actor_id,
            session_id=session_id,
            namespace=namespace,
            region=AWS_REGION
        )
        return memory_provider.tools
    except Exception as e:
        print(f"Failed to initialize memory provider: {e}")
        return []


def _create_memory_event(role: str, content: str, session_id: str = "", email: str = ""):
    """
    Create memory event in Bedrock AgentCore for conversation tracking.

    Args:
        role: Message role ('USER', 'ASSISTANT', 'TOOL')
        content: Message content
        session_id: Optional session identifier for conversation continuity
        email: Optional user email for memory tracking
    """
    if not AGENTCORE_MEMORY_ID:
        return

    # Create sanitized actor_id
    if email:
        actor_id = sanitize_email_for_actor_id(email)
    elif session_id:
        actor_id = f"user_{session_id}"
    else:
        return

    print(f"Creating memory event - Actor ID: {actor_id}, Session ID: {session_id}")

    try:
        memory_client = MemoryClient(region_name=AWS_REGION)
        memory_client.create_event(
            memory_id=AGENTCORE_MEMORY_ID,
            actor_id=actor_id,
            session_id=session_id,
            messages=[(content, role)]
        )
    except Exception as e:
        print(f"Failed to create memory event: {e}")


@tool
def job_search_agent_tool(query: str, resume_text: str = "", session_id: str = "", email: str = "") -> str:
    """
    Specialized job search agent that finds relevant job opportunities.

    Args:
        query: Job search query with user preferences and requirements
        email: User email for memory tracking
        resume_text: Optional resume content for personalized matching
        session_id: Optional session identifier for conversation continuity

    Returns:
        Job search results with personalized recommendations
    """
    try:
        # Get memory tools
        memory_tools = _get_memory_tools(session_id, email)

        # Combine all available tools
        tools = [retrieve, save_student_profile, get_student_profile] + memory_tools

        # Create a specialized job search agent
        job_search_agent = Agent(
            tools=tools,
            system_prompt=(
                "You are a specialized Job Search Agent focusing on finding relevant job opportunities with memory access.\n\n"
                "Available Tools:\n"
                f"• retrieve: Search job postings using knowledgeBaseId: '{JOB_SEARCH_KB}'\n"
                "• get_student_profile: Check user profile and notification preferences\n"
                "• save_student_profile: Store email and notification preferences\n"
                "• Memory tools: Access conversation history, previous job searches, and stored preferences\n\n"
                "MEMORY-AWARE JOB SEARCH WORKFLOW:\n"
                "1) Check memory for user's previous job search preferences and history\n"
                "2) Analyze user's skills, experience level, and preferences from resume/query\n"
                "3) Extract keywords and skill levels, considering user's stored preferences\n"
                "4) Reference previous job searches and company interests from memory\n"
                "5) Search job postings database for relevant opportunities based on history\n"
                "6) Filter and rank job matches considering user's career trajectory\n"
                "7) Set up daily notifications if user agrees, remembering past preferences\n\n"
                "User Types (Memory-Enhanced):\n"
                "• Entry-level & Internships: Recent graduates, students (check stored career goals)\n"
                "• Career Transition: Professionals switching industries (reference past transitions)\n"
                "• Part-time/School: Students balancing work and studies (recall previous part-time roles)\n\n"
                "MEMORY INTEGRATION:\n"
                "• Always reference user's previous job search criteria and preferences\n"
                "• Consider stored salary expectations and location preferences\n"
                "• Remember company types and industries user has shown interest in\n"
                "• Build on previous resume feedback and skill assessments\n\n"
                "Style: Concise, bullet-point results, recent jobs only. Personalize based on user's history."
            )
        )

        # Enhance query with resume context if available
        enhanced_query = query
        if resume_text:
            enhanced_query = f"{query}\n\nResume Context: {resume_text}"

        # Add session context if available
        if session_id or email:
            context_info = []
            if session_id:
                context_info.append(f"Session ID: {session_id}")
            if email:
                context_info.append(f"Email: {email}")
            enhanced_query = f"[{' | '.join(context_info)}]\n{enhanced_query}"

        response = job_search_agent(enhanced_query)
        return str(response)

    except Exception as e:
        return f"Error in job search agent: {str(e)}"


@tool
def career_advice_agent_tool(query: str, session_id: str = "", email: str = "") -> str:
    """
    Specialized career advice agent that provides guidance on career development.

    Args:
        query: Career advice question or request for guidance
        email: User email for memory tracking
        session_id: Optional session identifier for conversation continuity

    Returns:
        Career advice and guidance based on best practices
    """
    try:
        # Get memory tools
        memory_tools = _get_memory_tools(session_id, email)

        # Combine all available tools
        tools = [retrieve, save_student_profile, get_student_profile] + memory_tools

        # Create a specialized career advice agent
        career_advice_agent = Agent(
            tools=tools,
            system_prompt=(
                "You are a specialized Career Advice Agent providing guidance on career development with memory access.\n\n"
                f"Available Tools:\n"
                f"• retrieve: Access career resources using knowledgeBaseId: '{CARRIER_RESOURCE_KB}'\n"
                "• Memory tools: Access conversation history, previous advice sessions, and stored preferences\n\n"
                "MEMORY-AWARE CAREER GUIDANCE WORKFLOW:\n"
                "1) Review user's previous career advice sessions and stored preferences\n"
                "2) Analyze user's career goals and current situation in context of history\n"
                "3) Identify specific areas where guidance is needed, building on past discussions\n"
                "4) Search comprehensive career resources with personalized context\n"
                "5) Provide actionable advice considering user's career trajectory and past feedback\n"
                "6) Create step-by-step plans based on user's previous progress and preferences\n\n"
                "Career Advice Areas (Memory-Enhanced):\n"
                "• Resume writing and optimization (reference previous resume feedback)\n"
                "• Interview preparation and techniques (recall past interview experiences)\n"
                "• Career transition strategies (consider user's current career trajectory)\n"
                "• Skill development and learning paths (based on user's skill assessment history)\n"
                "• Networking and professional development (reference past networking activities)\n"
                "• Salary negotiation advice (use stored salary expectations and history)\n"
                "• Work-life balance guidance (consider user's previous balance discussions)\n\n"
                "MEMORY INTEGRATION:\n"
                "• Always reference previous career advice sessions and user preferences\n"
                "• Consider user's career goals and objectives from stored information\n"
                "• Build on previous feedback and recommendations given\n"
                "• Remember user's progress and achievements from past interactions\n\n"
                "Provide actionable, practical advice based on industry best practices.\n"
                "Cite relevant resources and provide step-by-step guidance when appropriate.\n"
                "Focus on helping users advance their careers and achieve their professional goals.\n"
                "Personalize all advice based on user's conversation history and stored preferences."
            )
        )

        # Add session context if available
        enhanced_query = query
        if session_id or email:
            context_info = []
            if session_id:
                context_info.append(f"Session ID: {session_id}")
            if email:
                context_info.append(f"Email: {email}")
            enhanced_query = f"[{' | '.join(context_info)}]\n{enhanced_query}"

        response = career_advice_agent(enhanced_query)
        return str(response)

    except Exception as e:
        return f"Error in career advice agent: {str(e)}"


class MultiAgentJobSearchSystem:
    """
    Orchestrator system that routes queries to specialized agents using the "Agents as Tools" pattern.
    Handles both job search and career advice queries through specialized agent tools.
    """

    def __init__(self, session_id: str = "", email: str = ""):
        """Initialize the orchestrator agent with routing capabilities."""
        # Get memory tools for the orchestrator
        memory_tools = _get_memory_tools(session_id, email)

        # Combine all available tools
        tools = [job_search_agent_tool, career_advice_agent_tool] + memory_tools

        self.orchestrator_agent = Agent(
            tools=tools,
            system_prompt=(
                "You are an intelligent Orchestrator Agent for a Career Services platform with full memory access.\n\n"
                "Available Specialized Agents:\n"
                "• job_search_agent_tool: Handles job search queries, finding opportunities, resume matching\n"
                "• career_advice_agent_tool: Provides career guidance, resume help, interview prep, career transitions\n"
                "• Memory tools: Access conversation history, preferences, and stored user information\n\n"
                "MEMORY ACCESS PROTOCOL:\n"
                "FIRST INTERACTION CHECK:\n"
                "• Always check memory for existing user preferences and conversation history\n"
                "• Use memory tools to recall previous job searches, career goals, and preferences\n"
                "• If preferences found, share them with user and ask for confirmation/updates\n"
                "• Reference stored resume information and previous interactions\n"
                "• Personalize responses based on user's history and stored preferences\n\n"
                "MEMORY-DRIVEN WORKFLOW:\n"
                "1) Load user memory and conversation history\n"
                "2) Analyze current query in context of user's history and confirmed preferences\n"
                "3) Reference previous preferences and stored information\n"
                "4) Personalize response based on user's profile and history\n"
                "5) Store new information and preferences for future interactions\n\n"
                "PREFERENCE SHARING PROTOCOL:\n"
                "• When loading memory for first interaction or after long absence\n"
                "• Share found preferences with user: 'I found these preferences from our previous interactions...'\n"
                "• Ask for confirmation: 'Would you like to update any of these preferences?'\n"
                "• Update stored preferences based on user feedback\n"
                "• Use confirmed preferences to personalize all responses\n\n"
                "Routing Guidelines:\n"
                "• Job Search Queries → Use job_search_agent_tool:\n"
                "  - Finding jobs or internships (consider user's previous job preferences)\n"
                "  - Job recommendations based on skills/resume and stored preferences\n"
                "  - Job market trends and opportunities (based on user's career field)\n\n"
                "• Career Advice Queries → Use career_advice_agent_tool:\n"
                "  - Resume writing and optimization (build on previous resume feedback)\n"
                "  - Interview preparation and techniques (reference past interview experiences)\n"
                "  - Career transition strategies (consider user's current career trajectory)\n"
                "  - Skill development and learning paths (based on user's skill assessment history)\n"
                "  - Networking and professional development (reference past networking activities)\n"
                "  - Salary negotiation advice (use stored salary expectations and history)\n"
                "  - Work-life balance guidance (consider user's previous balance discussions)\n\n"
                "General Questions: Answer directly while referencing stored user information\n"
                "Complex Queries: Route to appropriate specialized agents with full context from memory\n\n"
            )
        )


async def handle_agent_request(payload):
    """
    Handle agent request from AWS Bedrock Agent Runtime using the Multi-Agent Orchestrator system.

    Expected payload format:
    {
        "prompt": "Find me software engineering jobs in the Bay Area",
        "resume_text": "John Doe\nSoftware Engineer...",  # optional
        "session_id": "user123_session456"  # optional - enables conversation continuity
        "email": "user@example.com"  # optional - for memory tracking
    }

    Args:
        payload: Request payload from AWS Bedrock Agent Runtime

    Yields:
        Streaming response chunks from the orchestrator agent
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
    email = payload.get("email")

    if not prompt:
        yield {"error": "Error: 'prompt' is required."}
        return

    try:
        # Initialize the multi-agent orchestrator system with memory support
        orchestrator_system = MultiAgentJobSearchSystem(session_id=session_id, email=email)

        # Create memory event for user message
        _create_memory_event("USER", prompt, session_id, email)

        # Process the prompt with context information
        enhanced_prompt = prompt

        # Add session and email context if available
        context_parts = []
        if session_id:
            context_parts.append(f"Session: {session_id}")
        if email:
            context_parts.append(f"User: {email}")

        if context_parts:
            enhanced_prompt = f"[Context: {' | '.join(context_parts)}]\n{prompt}"

        # Add resume to prompt if provided (orchestrator can decide how to use it)
        if resume_text:
            enhanced_prompt += f"\n\nResume Context: {resume_text}"

        # Stream the response from the orchestrator agent
        final_response = ""
        async for event in orchestrator_system.orchestrator_agent.stream_async(enhanced_prompt):
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

        # Create memory event for assistant response
        if final_response:
            _create_memory_event("ASSISTANT", final_response, session_id, email)
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