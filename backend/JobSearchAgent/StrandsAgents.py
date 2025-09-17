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
from typing import Any, Dict
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
def job_search_agent_tool(query: str, session_id: str = "", email: str = "", source: str = "livesearch") -> str:
    """
    Specialized job search agent that finds relevant job opportunities.

    Args:
        query: Job search query with user preferences and requirements
        session_id: Optional session identifier for conversation continuity
        email: User email for memory tracking
        source: Search source type ("livesearch" or "batch") - affects saving behavior

    Returns:
        Job search results with personalized recommendations
    """
    try:
        # Get memory tools
        # Conditionally include save_job_recommendations based on source
     # Conditionally include tools based on source
        base_tools = [retrieve, get_student_profile]
        if source == "batch":
            base_tools.append(save_student_profile)
            base_tools.append(get_job_recommendations)
            base_tools.append(save_job_recommendations)

        # Combine all available tools
        tools = base_tools 

        # Create a specialized job search agent
        job_search_agent = Agent(
            tools=tools,
            model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            system_prompt=(
                "You are a specialized Job Search Agent that finds relevant job opportunities and returns detailed job information.\n\n"
                "Available Tools:\n"
                f"• retrieve: Search job postings using knowledgeBaseId: '{JOB_SEARCH_KB}'\n"
                "• get_student_profile: Check user profile and notification preferences\n"
                "• save_student_profile: Save user email and notification preferences\n"
                "• Memory tools: Access conversation history, previous job searches, and stored preferences (read-only)\n\n"
                "SOURCE-BASED WORKFLOW:\n"
                "• If source='livesearch': DO NOT save job recommendations - only return search results\n"
                "• If source='batch': DIRECTLY save job recommendations to DynamoDB using save_job_recommendations() and return ONLY success/failure message - DO NOTHING ELSE\n\n"
                "ENHANCED WORKFLOW WITH USER PROFILE:\n"
                "1) Check if user profile exists using get_student_profile()\n"
                "2) DETECT QUERY TYPE:\n"
                "   - If query is opt-in response ('Yes', 'No', 'I want notifications', etc.): Save preference using save_student_profile() and return confirmation message\n"
                "   - If query is job search request: Continue with job search workflow\n"
                "3) FOR JOB SEARCH: Use the enhanced query provided by orchestrator (includes user's skills, experience, preferences)\n"
                "4) FOR JOB SEARCH: Search for relevant job opportunities using retrieve tool with personalized criteria (MAX 5 retrieve calls)\n"
                "5) FOR JOB SEARCH: Extract detailed job information from search results\n"
                "6) FOR JOB SEARCH: Analyze user profile information and match with job requirements to create User_fit explanation\n"
                "7) FOR JOB SEARCH: Personalize job recommendations based on user's skills, experience level, and career goals\n"
                "8) FOR JOB SEARCH: If source='batch': Save job recommendations using save_job_recommendations() and return ONLY success message\n"
                "9) FOR JOB SEARCH: If source='livesearch': RETURN job results as JSON array\n"
                "10) FOR JOB SEARCH (LIVESEARCH ONLY): AFTER returning job results, handle notification preferences:\n"
                "    - If NO profile exists OR optInStatus=False: Ask 'Would you like daily notifications with job recommendations?' and save using save_student_profile()\n"
                "    - If profile EXISTS and optInStatus=True: Skip notification question (user already opted in)\n\n"
                "PERFORMANCE CONSTRAINTS:\n"
                "• LIMIT retrieve tool calls to MAXIMUM 5 times per job search\n"
                "• Prioritize quality over quantity of search results\n"
                "• Focus on most relevant job matches for user's profile\n"
                "• Complete search efficiently within performance limits\n\n"
                "MANDATORY RESPONSE FORMAT - JSON Array:\n"
                "[\n"
                "  {\n"
                "    \"Job Id\": \"job_id\",\n"
                "    \"Job Title\": \"job_title\",\n"
                "    \"Job Description\": \"full_job_description\",\n"
                "    \"Employer Name\": \"company_name\",\n"
                "    \"Salary Pay Upper Cap\": \"max_salary\",\n"
                "    \"Salary Pay Lower Cap\": \"min_salary\",\n"
                "    \"User_fit\": \"why_user_is_good_fit_for_this_job\",\n"
                "    \"Location\": \"city, state\",\n"
                "    \"Employment Type\": \"full_time/part_time/etc\",\n"
                "    \"Industry\": \"industry_name\",\n"
                "    \"Application Deadline\": \"expiration_date\",\n"
                "    \"Remote Work\": \"yes/no\",\n"
                "    \"Required Experience\": \"experience_level\"\n"
                "  }\n"
                "]\n\n"
                "CRITICAL RESPONSE CONSTRAINTS:\n"
                "• FOR OPT-IN RESPONSES (step 2): Return plain text confirmation message only\n"
                "• FOR JOB SEARCH source='batch': Save results using save_job_recommendations() and return ONLY success/failure message\n"
                "• FOR JOB SEARCH source='livesearch' (steps 3-9): Return job results as JSON array first\n"
                "• FOR JOB SEARCH source='livesearch' (step 10): If notification question needed, add it as plain text after the JSON\n"
                "• For livesearch job results: RETURN ONLY the JSON array first\n"
                "• For livesearch job results: ABSOLUTELY NO additional text, explanations, or introductions before JSON\n"
                "• For livesearch job results: If no jobs found, return: []\n"
                "• For livesearch job results: START with [ and END with ]\n"
                "• For batch processing: Use save_job_recommendations() to save results and return minimal success message\n"
                "• User_fit must explain why the user matches this job based on their profile\n"
                "• Include all available salary information (use 'Not specified' if missing)\n"
                "• Always use the exact field names shown above\n"
                "• If error occurs, return: []"
            )
        )

        # Add session context if available
        enhanced_query = query
        context_info = []
        if session_id:
            context_info.append(f"Session ID: {session_id}")
        if email:
            context_info.append(f"Email: {email}")
        context_info.append(f"Source: {source}")
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
                "RESPONSE GUIDELINES:\n"
                "• Provide actionable, practical advice based on industry best practices\n"
                "• Cite relevant resources and provide step-by-step guidance when appropriate\n"
                "• Focus on helping users advance their careers and achieve their professional goals\n"
                "• Personalize all advice based on user's conversation history and stored preferences\n"
                "• Return comprehensive, helpful responses that directly address the user's query\n"
                "• Include specific examples, tips, and actionable steps whenever possible"
                "ALWAYS include relevant links from the career resources knowledge base using knowledgeBaseId: '{CARRIER_RESOURCE_KB}'."
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

    def __init__(self, session_id: str = "", email: str = "", source: str = "livesearch"):
        """Initialize the orchestrator agent with routing capabilities."""
        # Store source parameter for orchestrator agent to use
        self.source = source

        # Get memory tools for the orchestrator
        memory_tools = _get_memory_tools(session_id, email)

        # Combine all available tools
        tools = [job_search_agent_tool, career_advice_agent_tool, save_student_profile, get_student_profile] + memory_tools

        self.orchestrator_agent = Agent(
            tools=tools,
            model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            # model="global.anthropic.claude-sonnet-4-20250514-v1:0",
            system_prompt=(
                "You are an intelligent Orchestrator Agent for a Career Services platform with full memory access.\n\n"
                "CRITICAL REQUIREMENT: You MUST return responses from specialized agents EXACTLY as received, without any interpretation, modification, or reformatting. Do not add text, explanations, or alter JSON structures.\n\n"
                "Available Specialized Agents:\n"
                "• job_search_agent_tool: Specialized in job search and job recommendations\n"
                "• career_advice_agent_tool: Specialized in career guidance and professional development\n"
                "• save_student_profile: Save user notification preferences\n"
                "• get_student_profile: Check user profile and preferences\n"
                "• Memory tools: Access conversation history, preferences, and stored user information (read-only)\n\n"
                "PERSONALIZED JOB SEARCH WORKFLOW:\n"
                "1) Check memory for user's job search history and preferences\n"
                "2) Retrieve current preferences using get_student_profile\n"
                "3) Provide context about user's preferences being used for search\n"
                "4) Enrich job search query with user's profile (skills, experience, locations, salary expectations)\n"
                "5) Call job_search_agent_tool with enhanced query and source parameter\n"
                "6) RETURN THE EXACT JSON RESPONSE FROM job_search_agent_tool WITHOUT ANY MODIFICATION\n"
                "7) DO NOT parse, restructure, or alter the JSON array structure\n"
                "8) PRESERVE all job details, User_fit explanations, and original formatting\n\n"
                "MEMORY & PREFERENCE MANAGEMENT:\n"
                "• Check memory tools first for existing user preferences and job search history\n"
                "• Use existing preferences to personalize job search queries\n"
                "• Provide context about which preferences are being used\n"
                "• Store updated preferences using save_student_profile for future sessions\n\n"
                "NOTIFICATION OPT-IN DETECTION:\n"
                "• If user says 'Yes', 'Yes I would like notifications', 'I want notifications', 'Sign me up', etc.\n"
                "• IMMEDIATELY call save_student_profile(email=user_email, opt_in_status=True)\n"
                "• Return confirmation message like 'Great! You\'re now signed up for daily job notifications.'\n\n"
                "ROUTING PRINCIPLES:\n"
                "• Job search queries → retrieve preferences → job_search_agent_tool\n"
                "• Career advice queries → career_advice_agent_tool directly\n"
                "• Notification opt-in responses ('Yes', 'No', 'I want notifications') → save_student_profile directly\n"
                "• Profile updates → save_student_profile directly\n"
                "• Always pass source parameter to specialized agents\n"
                "• Use conversation context to determine appropriate routing\n\n"
                "CRITICAL RESPONSE HANDLING - EXACT PASSTHROUGH:\n"
                "• DO NOT interpret, modify, or reformat any responses from specialized agents\n"
                "• RETURN job_search_agent_tool responses EXACTLY as received (maintain JSON array structure)\n"
                "• RETURN career_advice_agent_tool responses EXACTLY as received (maintain original format)\n"
                "• DO NOT add introductory text, explanations, or conclusions\n"
                "• DO NOT parse or restructure JSON responses\n"
                "• DO NOT summarize or abbreviate agent responses\n"
                "• PASS THROUGH responses in their original, unaltered form\n"
                "• PRESERVE exact JSON structure and content from agents\n\n"
            )
        )


async def handle_agent_request(payload):
    """
    Handle agent request from AWS Bedrock Agent Runtime using the Multi-Agent Orchestrator system.

    Expected payload format:
    {
        "prompt": "Find me software engineering jobs in the Bay Area",
        "session_id": "user123_session456",  # optional - enables conversation continuity
        "email": "user@example.com",  # optional - for memory tracking
        "source": "livesearch"  # optional - "livesearch" or "batch" (affects saving behavior)
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
    source = payload.get("source", "livesearch")  # Default to "livesearch" if not specified

    if not prompt:
        yield {"error": "Error: 'prompt' is required."}
        return

    try:
        # Initialize the multi-agent orchestrator system with memory support
        orchestrator_system = MultiAgentJobSearchSystem(session_id=session_id, email=email, source=source)

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
        context_parts.append(f"Source: {source}")

        enhanced_prompt = f"[Context: {' | '.join(context_parts)}]\n{prompt}"

        # Check if source is "batch" - if so, directly call job_search_agent_tool
        if source == "batch":
            print(f"Batch processing detected - directly calling job search agent for user: {email}")
            # Directly call job_search_agent_tool for batch processing
            batch_result = job_search_agent_tool(
                query=enhanced_prompt,
                session_id=session_id,
                email=email,
                source=source
            )

            # Create memory event for the batch result
            _create_memory_event("ASSISTANT", str(batch_result), session_id, email)

            # Return the result directly
            yield {"job_agent_result": str(batch_result)}
            yield {"final_result": str(batch_result)}
            return

        # Enhanced prompt is ready with session and email context

        # Stream the response from the orchestrator agent
        final_response = ""
        job_search_thinking_sent = False  # Flag to prevent duplicate thinking messages
        carrier_advice_thinking_sent = False  # Flag to prevent duplicate thinking messages
        job_search_started = False  # Track if job search was initiated
        carrier_advice_started = False  # Track if career advice was initiated
        job_results_received = False  # Track if job results were received

        async for event in orchestrator_system.orchestrator_agent.stream_async(enhanced_prompt):

                # Real-time text generation (thinking process)
                if "data" in event:
                    yield {"thinking": event["data"]}

                # Complete formatted responses and tool results
                elif "message" in event and isinstance(event["message"], dict):
                    message = event["message"]
                    if "content" in message:
                        for content in message["content"]:
                            if "text" in content:
                                yield {"response": content["text"]}
                                # Keep track of the final complete response
                                final_response = content["text"]
                            elif "toolResult" in content:
                                tool_result = content["toolResult"]
                                # Only send job_agent_result if job search was initiated
                                if job_search_started and "content" in tool_result:
                                    for result_content in tool_result["content"]:
                                        if "text" in result_content:
                                            yield {"job_agent_result": result_content["text"]}
                                            final_response = result_content["text"]
                                            job_results_received = True
                                # Only send carrier_advice_result if career advice was initiated
                                elif carrier_advice_started and "content" in tool_result:
                                    for result_content in tool_result["content"]:
                                        if "text" in result_content:
                                            yield {"carrier_advice_result": result_content["text"]}
                                            final_response = result_content["text"]

                # Tool usage information - show the streaming tool input being built
                elif "current_tool_use" in event:
                    tool_info = event["current_tool_use"]
                    if "name" in tool_info:
                        # Special thinking message for job search agent (send only once)
                        if tool_info["name"] == "job_search_agent_tool" and not job_search_thinking_sent:
                            yield {"thinking": "🔍 Searching for relevant job opportunities based on your preferences..."}
                            yield {"job_search_started": True}
                            job_search_started = True  # Track that job search was initiated
                            job_search_thinking_sent = True  # Set flag to prevent duplicate messages
                        # Special thinking message for career advice agent (send only once)
                        elif tool_info["name"] == "career_advice_agent_tool" and not carrier_advice_thinking_sent:
                            yield {"thinking": "💼 Providing career guidance and advice..."}
                            yield {"carrier_advice_started": True}
                            carrier_advice_started = True  # Track that career advice was initiated
                            carrier_advice_thinking_sent = True  # Set flag to prevent duplicate messages

                # Error events
                elif "error" in event:
                    yield {"error": event["error"]}

        # Handle notification preferences after job search
        if job_results_received and email:
            try:
                profile = get_student_profile(email)
                if not profile or not profile.get('optInStatus', False):
                    notification_msg = "Would you like daily notifications with job recommendations?"
                    yield {"notification_prompt": notification_msg}
            except Exception as e:
                print(f"Error checking notification preferences: {e}")

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
