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

def _get_live_job_search_prompt() -> str:
    """Get system prompt for live job search (interactive user queries)."""
    return (
        "You are a specialized Job Search Agent for LIVE SEARCH that finds relevant job opportunities and returns detailed job information.\n\n"
        "Available Tools:\n"
        f"• retrieve: Search job postings using knowledgeBaseId: '{JOB_SEARCH_KB}'\n"
        "• get_student_profile: Check user profile and notification preferences\n"
        "• Memory tools: Access conversation history, previous job searches, and stored preferences (read-only)\n\n"
        "LIVE SEARCH WORKFLOW:\n"
        "1) Check if user profile exists using get_student_profile()\n"
        "2) FOR JOB SEARCH: Use the enhanced query provided by orchestrator (includes user's skills, experience, preferences)\n"
        "3) FOR JOB SEARCH: Search for relevant job opportunities using retrieve tool with personalized criteria (MAX 5 retrieve calls)\n"
        "4) FOR JOB SEARCH: Extract detailed job information from search results\n"
        "5) FOR JOB SEARCH: Perform COMPREHENSIVE user fit analysis using all available information:\n"
        "   • User's conversation history and stated preferences\n"
        "   • User's profile data (email, notification preferences, opt-in status)\n"
        "   • Job requirements vs user's implied skills and experience\n"
        "   • Career progression opportunities and growth potential\n"
        "   • Work environment and culture fit based on conversation context\n"
        "6) FOR JOB SEARCH: Create detailed, specific fit explanations that include:\n"
        "   • Specific skill matches and experience alignment\n"
        "   • Career development and growth opportunities\n"
        "   • Work environment and role suitability\n"
        "   • Why this job stands out for this user's profile\n"
        "7) FOR JOB SEARCH: RETURN job results as JSON array\n"
        "PERFORMANCE CONSTRAINTS:\n"
        "• LIMIT retrieve tool calls to MAXIMUM 5 times per job search\n"
        "• Prioritize quality over quantity of search results\n"
        "• Focus on most relevant job matches for user's profile\n"
        "• Complete search efficiently within performance limits\n\n"
        "MANDATORY RESPONSE FORMAT - JSON Array:\n"
        "[\n"
        "  {\n"
        "    \"id\": \"job_id\",\n"
        "    \"title\": \"job_title\",\n"
        "    \"description\": \"job_description\",\n"
        "    \"company\": \"company_name\",\n"
        "    \"salary_max\": \"max_salary\",\n"
        "    \"salary_min\": \"min_salary\",\n"
        "    \"fit\": \"why_user_is_good_fit\",\n"
        "    \"location\": \"city, state\",\n"
        "    \"type\": \"employment_type\",\n"
        "    \"industry\": \"industry_name\",\n"
        "    \"deadline\": \"expiration_date\",\n"
        "    \"remote\": \"yes/no\",\n"
        "    \"experience\": \"experience_level\"\n"
        "  }\n"
        "]\n\n"
        "CRITICAL RESPONSE CONSTRAINTS:\n"
        "• FOR JOB SEARCH (steps 3-8): Return job results as JSON array first\n"
        "• ABSOLUTELY NO additional text, explanations, or introductions before JSON\n"
        "• If no jobs found, return: []\n"
        "• START with [ and END with ]\n"
        "• fit must provide COMPREHENSIVE analysis of why user matches this job:\n"
        "  - Specific skill and experience alignment\n"
        "  - Career growth and development opportunities\n"
        "  - Work environment and role suitability\n"
        "  - Unique value proposition for this user's profile\n"
        "  - How this job advances their career goals\n"
        "• Include all available salary information (use 'Not specified' if missing)\n"
        "• Always use the exact field names shown above\n"
    )


def _get_batch_job_search_prompt() -> str:
    """Get system prompt for batch job search (automated processing)."""
    return (
        "You are a specialized Job Search Agent for BATCH PROCESSING that finds relevant job opportunities and saves them to the database.\n\n"
        "Available Tools:\n"
        f"• retrieve: Search job postings using knowledgeBaseId: '{JOB_SEARCH_KB}'\n"
        "• get_student_profile: Check user profile and notification preferences\n"
        "• save_job_recommendations: Save job recommendations to DynamoDB\n"
        "• get_job_recommendations: Retrieve existing job recommendations\n"
        "• Memory tools: Access conversation history, previous job searches, and stored preferences (read-only)\n\n"
        "BATCH PROCESSING WORKFLOW:\n"
        "1) Check if user profile exists using get_student_profile()\n"
        "2) Use the enhanced query provided by orchestrator (includes user's skills, experience, preferences)\n"
        "3) Search for relevant job opportunities using retrieve tool with personalized criteria (MAX 5 retrieve calls)\n"
        "4) Extract detailed job information from search results\n"
        "5) Perform COMPREHENSIVE user fit analysis using all available information:\n"
        "   • User's conversation history and stated preferences\n"
        "   • User's profile data (email, notification preferences, opt-in status)\n"
        "   • Job requirements vs user's implied skills and experience\n"
        "   • Career progression opportunities and growth potential\n"
        "   • Work environment and culture fit based on conversation context\n"
        "6) Create detailed, specific fit explanations that include:\n"
        "   • Specific skill matches and experience alignment\n"
        "   • Career development and growth opportunities\n"
        "   • Work environment and role suitability\n"
        "   • Why this job stands out for this user's profile\n"
        "7) Save job recommendations using save_job_recommendations()\n"
        "8) Return ONLY success/failure message - DO NOTHING ELSE\n\n"
        "PERFORMANCE CONSTRAINTS:\n"
        "• LIMIT retrieve tool calls to MAXIMUM 5 times per job search\n"
        "• Prioritize quality over quantity of search results\n"
        "• Focus on most relevant job matches for user's profile\n"
        "• Complete search efficiently within performance limits\n\n"
        "MANDATORY RESPONSE FORMAT:\n"
        "• FOR BATCH PROCESSING: Return ONLY success/failure message\n"
        "• Examples: 'Job recommendations saved successfully' or 'Error saving job recommendations'\n"
        "• DO NOT return JSON arrays or job details\n"
        "• DO NOT ask about notifications or preferences\n"
        "• Focus only on saving results and confirming success/failure\n"
        "• If error occurs, return: 'Error processing batch job search'"
    )


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


def _get_session_history(session_id: str = "", email: str = "", max_turns: int = 5):
    """
    Retrieve short-term memory (conversation history) for the current session.
    
    Args:
        session_id: Session identifier
        email: User email for actor_id
        max_turns: Maximum number of recent conversation turns to retrieve
    
    Returns:
        Formatted conversation history string or empty string if none found
    """
    
    # Create sanitized actor_id
    if email:
        actor_id = sanitize_email_for_actor_id(email)
    elif session_id:
        actor_id = f"user_{session_id}"
    else:
        return ""
    
    try:
        memory_client = MemoryClient(region_name=AWS_REGION)
        recent_turns = memory_client.get_last_k_turns(
            memory_id=AGENTCORE_MEMORY_ID,
            actor_id=actor_id,
            session_id=session_id,
            k=max_turns,
            branch_name="main"
        )
        
        if recent_turns:
            # Format conversation history for context
            context_messages = []
            for turn in recent_turns:
                for message in turn:
                    role = message['role'].lower()
                    content = message['content']['text']
                    context_messages.append(f"{role.title()}: {content}")
            
            return "\n".join(context_messages)
        else:
            return ""
        
    except Exception as e:
        print(f"Failed to retrieve session history: {e}")
        return ""


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

        # Select appropriate system prompt based on source
        if source == "batch":
            system_prompt = _get_batch_job_search_prompt()
        else:  # livesearch
            system_prompt = _get_live_job_search_prompt()
            # Add conversation history for livesearch only
            conversation_history = _get_session_history(session_id, email)
            if conversation_history:
                system_prompt += f"\n\nRecent conversation history:\n{conversation_history}\n\nContinue the conversation naturally based on this context."

        # Create a specialized job search agent with updated system prompt
        job_search_agent = Agent(
            tools=tools,
            model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            system_prompt=system_prompt
        )

        # Add session context
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
            model="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            system_prompt=(
                "You are a specialized Career Advice Agent providing guidance on career development with memory access.\n\n"
                f"Available Tools:\n"
                f"• retrieve: Access career resources using knowledgeBaseId: '{CARRIER_RESOURCE_KB}'\n"
                "• Memory tools: Access conversation history, previous advice sessions, and stored preferences\n\n"
                "MEMORY-AWARE CAREER GUIDANCE WORKFLOW:\n"
                "1) Review user's previous career advice sessions and stored preferences\n"
                "2) Analyze user's career goals and current situation in context of history\n"
                "3) Identify specific areas where guidance is needed, building on past discussions\n"
                "4) Search comprehensive career resources with personalized context (use retrieve 3-5 times)\n"
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
                "URL EXTRACTION AND DEBUGGING:\n"
                "• Use retrieve tool 3-5 times with different search terms to find URLs\n"
                "• ALWAYS show what retrieve tool returns by including: 'Retrieved content: [first 200 chars]'\n"
                "• Scan ALL retrieve results for URLs (http://, https://, www., .com, .org, .edu)\n"
                "• Look for patterns: https://example.com, www.example.com, http://site.org\n"
                "• Search specifically for 'resources', 'links', 'websites', 'tools' to find URL-containing content\n"
                "• If URLs found: Include in 'Web Resources:' section with only the URLs in format: https://example.com\n"
                "• If NO URLs found: State 'No web resources found in knowledge base' AND show sample retrieve content\n"
                f"• Only use actual content from knowledgeBaseId: '{CARRIER_RESOURCE_KB}'\n"
                "• CRITICAL: Show retrieve debugging info to help identify if URLs exist in knowledge base"
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
                "FOLLOW-UP QUESTIONS:\n"
                "• After agent results, add 2-3 questions based on 'Recent conversation:' history\n"
                "• Reference specific details from previous messages to personalize questions\n"
                "• Format: End with '\n\nNext steps: 1. [question] 2. [question] 3. [question]'\n\n"
                "CRITICAL RESPONSE HANDLING - EXACT PASSTHROUGH:\n"
                "• CALL each specialized agent only ONCE per query\n"
                "• DO NOT call career_advice_agent_tool multiple times\n"
                "• PRESERVE all links and URLs from knowledge base retrieve results\n"
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

        # Store user message in memory before processing
        if session_id or email:
            _create_memory_event("USER", prompt, session_id, email)
            # Small delay to ensure memory is stored before retrieval
            import time
            time.sleep(0.1)

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

        # For livesearch, add conversation history to orchestrator system prompt
        if source == "livesearch":
            conversation_history = _get_session_history(session_id, email)
            if conversation_history:
                # Add conversation history to orchestrator's system prompt
                orchestrator_system.orchestrator_agent.system_prompt += f"\n\nRecent conversation history:\n{conversation_history}\n\nContinue the conversation naturally based on this context."

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

        # Store assistant response in memory and yield final result
        if final_response:
            if session_id or email:
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
