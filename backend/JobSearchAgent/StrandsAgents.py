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

from tools import get_student_profile, save_student_profile, sanitize_email_for_actor_id, save_job_recommendations, get_job_recommendations

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
def job_search_agent_tool(query: str, session_id: str = "", email: str = "") -> str:
    """
    Specialized job search agent that finds relevant job opportunities.

    Args:
        query: Job search query with user preferences and requirements
        session_id: Optional session identifier for conversation continuity
        email: User email for memory tracking

    Returns:
        Job search results with personalized recommendations
    """
    try:
        # Get memory tools
        memory_tools = _get_memory_tools(session_id, email)

        # Combine all available tools
        tools = [
            retrieve,
            get_student_profile,
            save_job_recommendations,
            get_job_recommendations
        ] + memory_tools

        # Create a specialized job search agent
        job_search_agent = Agent(
            tools=tools,
            model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            system_prompt=(
                "You are a specialized Job Search Agent focusing on finding relevant job opportunities with memory access.\n\n"
                "Available Tools:\n"
                f"• retrieve: Search job postings using knowledgeBaseId: '{JOB_SEARCH_KB}'\n"
                "• get_student_profile: Check user profile and notification preferences\n"
                "• save_job_recommendations: Save job recommendations to database for tracking\n"
                "• get_job_recommendations: Retrieve previous job recommendations for a user\n"
                "• Memory tools: Access conversation history, previous job searches, and stored preferences\n\n"
                "JOB SEARCH WORKFLOW:\n"
                "1) Check memory for user's previous job search preferences and history\n"
                "2) Analyze user's skills, experience level, and preferences from query and stored data\n"
                "3) Search job postings database for relevant opportunities based on history\n"
                "4) Filter and rank job matches considering user's career trajectory\n"
                "5) DISPLAY ALL FOUND JOBS: Show complete job listings with EXACT job IDs that will be saved\n"
                "6) SAVE MULTIPLE JOBS: Use save_job_recommendations() with SAME job IDs shown to user\n"
                "7) Set up daily notifications if user agrees, remembering past preferences\n\n"
                "CRITICAL DISPLAY REQUIREMENT:\n"
                "• ALWAYS show the actual job listings to the user - NEVER just summarize\n"
                "• If you find jobs, DISPLAY THEM IMMEDIATELY in the specified format\n"
                "• DO NOT ask questions or give summaries without showing the jobs first\n"
                "• Show jobs BEFORE asking follow-up questions\n"
                "• ENSURE job IDs in display match EXACTLY what gets saved to save_job_recommendations()\n\n"
                "JOB DISPLAY & SAVING CONSISTENCY:\n"
                "• CRITICAL: Job IDs shown in response MUST match EXACTLY what's saved to backend\n"
                "• The job IDs you display to users should be IDENTICAL to what you save via save_job_recommendations()\n"
                "• Extract job IDs and titles from ALL displayed jobs\n"
                "• Determine job category based on query: 'software-engineer', 'data-scientist', 'product-manager', etc.\n"
                "• Use user's email from context to save recommendations under correct user\n"
                "• Always use sent_via='livesearch' for live user interactions\n"
                "• Example: If you share job IDs [10000089, 10000176, 10000245], save EXACTLY those same IDs\n\n"
                "MEMORY INTEGRATION:\n"
                "• Always reference user's previous job search criteria and preferences\n"
                "• Consider stored salary expectations and location preferences\n"
                "• Remember company types and industries user has shown interest in\n"
                "• Build on previous skill assessments and career goals\n"
                "• Track and reference previous job recommendations to avoid duplicates\n"
                "• Use saved recommendations for notification and follow-up systems\n\n"
                "Style: Comprehensive job listings with full details, recent jobs only. Personalize based on user's history."
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
            model="us.anthropic.claude-3-5-haiku-20241022-v1:0",
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
            model="global.anthropic.claude-sonnet-4-20250514-v1:0",
            system_prompt=(
                "You are an intelligent Orchestrator Agent for a Career Services platform with full memory access.\n\n"
                "Available Specialized Agents:\n"
                "• job_search_agent_tool: Handles job search queries, finding opportunities based on skills and preferences\n"
                "• career_advice_agent_tool: Provides career guidance, interview prep, career transitions\n"
                "• Memory tools: Access conversation history, preferences, and stored user information\n\n"
                "MEMORY ACCESS PROTOCOL:\n"
                "SMART MEMORY CHECK:\n"
                "• Check memory briefly on first interaction to understand user preferences\n"
                "• If preferences found, share them once and proceed with job search\n"
                "• DO NOT repeatedly check memory and ask for confirmation in a loop\n"
                "• Once user confirms preferences, proceed immediately to job search\n\n"
                "JOB SEARCH TRIGGERING:\n"
                "• When user explicitly asks for jobs: ROUTE IMMEDIATELY to job_search_agent_tool\n"
                "• Do NOT get stuck in memory-checking loops when user has already confirmed\n"
                "• If user says 'yes' to job search: proceed without further confirmation\n"
                "• Break the confirmation loop and actually perform the job search\n\n"
                "CORE BEHAVIOR:\n"
                "1) Check memory once, then proceed with job search when user confirms\n"
                "2) For career advice questions: Route immediately to career_advice_agent_tool\n"
                "3) For job search requests: Route to job_search_agent_tool after ONE confirmation\n"
                "4) DO NOT create endless confirmation loops - proceed after user says 'yes'\n"
                "5) NEVER answer questions directly - ALWAYS route to specialized agents when appropriate\n"
                "6) When user asks for jobs and confirms preferences: SEARCH IMMEDIATELY\n\n"
                "JOB DISPLAY PROTOCOL:\n"
                "• When job_search_agent_tool returns job results: DISPLAY THEM TO USER IMMEDIATELY\n"
                "• Show all jobs found in the same comprehensive format as specified in job search agent\n"
                "• Include job titles, companies, locations, salaries, descriptions, and job IDs\n"
                "• Format as numbered list with emojis and clear sections\n"
                "• DO NOT summarize or ask questions first - show the jobs immediately\n"
                "• After displaying jobs, then ask follow-up questions if needed\n\n"
            )
        )


async def handle_agent_request(payload):
    """
    Handle agent request from AWS Bedrock Agent Runtime using the Multi-Agent Orchestrator system.

    Expected payload format:
    {
        "prompt": "Find me software engineering jobs in the Bay Area",
        "session_id": "user123_session456",  # optional - enables conversation continuity
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

        # Enhanced prompt is ready with session and email context

        # Stream the response from the orchestrator agent
        final_response = ""
        job_search_thinking_sent = False  # Flag to prevent duplicate thinking messages
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
                    # Special thinking message for job search agent (send only once)
                    if tool_info["name"] == "job_search_agent_tool" and not job_search_thinking_sent:
                        yield {"thinking": "🔍 Searching for relevant job opportunities based on your preferences..."}
                        yield {"job_search_started": True}
                        job_search_thinking_sent = True  # Set flag to prevent duplicate messages

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