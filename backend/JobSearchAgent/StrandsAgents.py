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
from typing import Any, Dict, AsyncIterator
from dataclasses import dataclass
import boto3
from bedrock_agentcore.memory import MemoryClient

from strands import Agent, tool
from strands.models import BedrockModel
from strands_tools.agent_core_memory import AgentCoreMemoryToolProvider
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from tools import get_student_profile, sanitize_email_for_actor_id, save_job_recommendations, get_job_recommendations, retrieve
from tools.retrieve import get_top_sources_for_current_request, clear_current_request_sources

# SubAgentResult for streaming events from career advice agent
@dataclass
class SubAgentResult:
    agent: Agent
    event: dict

# Environment Variables
AWS_REGION = os.getenv('AWS_REGION', 'us-west-2')
AGENTCORE_MEMORY_ID = os.getenv('AGENTCORE_MEMORY_ID')
AGENTCORE_USER_PREFERENCE_STRATEGY_ID = os.getenv('AGENTCORE_USER_PREFERENCE_STRATEGY_ID')
JOB_SEARCH_KB = os.getenv('JOB_SEARCH_KB') # Job search knowledge base ID - agent should use this for retrieve tool calls
CARRIER_RESOURCE_KB = os.getenv('CARRIER_RESOURCE_KB')  # Carrier resource knowledge base ID for additional resources

# Cross-account AWS credentials (optional)
CROSS_ACCOUNT_ACCESS_KEY_ID = os.getenv('CROSS_ACCOUNT_ACCESS_KEY_ID')
CROSS_ACCOUNT_SECRET_ACCESS_KEY = os.getenv('CROSS_ACCOUNT_SECRET_ACCESS_KEY')
CROSS_ACCOUNT_REGION = os.getenv('CROSS_ACCOUNT_REGION', AWS_REGION)

# Create custom boto3 session if cross-account credentials are provided
if CROSS_ACCOUNT_ACCESS_KEY_ID and CROSS_ACCOUNT_SECRET_ACCESS_KEY:
    print(f"Using cross-account AWS credentials for region: {CROSS_ACCOUNT_REGION}")
    boto_session = boto3.Session(
        aws_access_key_id=CROSS_ACCOUNT_ACCESS_KEY_ID,
        aws_secret_access_key=CROSS_ACCOUNT_SECRET_ACCESS_KEY,
        region_name=CROSS_ACCOUNT_REGION
    )
else:
    print(f"Using default AWS credentials for region: {AWS_REGION}")
    boto_session = None  # Will use default credentials

# Fallback handling for missing knowledge bases
if not CARRIER_RESOURCE_KB:
    print("Warning: CARRIER_RESOURCE_KB not set, career advice may not work properly")
if not JOB_SEARCH_KB:
    print("Warning: JOB_SEARCH_KB not set, job search may not work properly")

# Create BedrockModel with custom session (if cross-account credentials provided)
if boto_session:
    bedrock_model = BedrockModel(
        model_id="global.anthropic.claude-sonnet-4-5-20250929-v1:0",
        boto_session=boto_session
    )
else:
    # Use default model string (will use default AWS credentials)
    bedrock_model = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"

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
        "3) FOR JOB SEARCH: Search for relevant job opportunities using retrieve tool with personalized criteria (MAX 2-3 retrieve calls)\n"
        "4) FOR JOB SEARCH: Extract detailed job information from search results, including the external apply ur for the job application\n"
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
        "• LIMIT retrieve tool calls to MAXIMUM 2-3 times per job search\n"
        "• Prioritize quality over quantity of search results\n"
        "• Give maximum 5 results to the user per job search\n"
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
        "    \"external_apply_url\": \"Apply_URL_FOR_THE_JOB\"\n"
        "  }\n"
        "]\n\n"
        "CRITICAL RESPONSE CONSTRAINTS:\n"
        "• FOR JOB SEARCH (steps 3-8): Return job results as JSON array first\n"
        "• ABSOLUTELY NO additional text, explanations, or introductions before JSON\n"
        "• If no jobs found, return: []\n"
        "• START with [ and END with ]\n"
        "• fit must provide analysis of why user matches this job (MAX 50 words):\n"
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
        "• save_job_recommendations: Save job recommendations to DynamoDB\n"
        "• get_job_recommendations: Retrieve existing job recommendations\n"
        "• Memory tools: Access conversation history, previous job searches, and stored preferences (read-only)\n\n"
        "BATCH PROCESSING WORKFLOW:\n"
        "1) Extract preferred job roles from user profile data (check 'preferredJobRole' field)\n"
        "2) For EACH preferred job role, perform these steps:\n"
        "   a) Use the enhanced query provided by orchestrator (includes user's skills, experience, preferences)\n"
        "   b) Search for relevant job opportunities using retrieve tool with personalized criteria (MAX 5 retrieve calls total per role)\n"
        "   c) Extract detailed job information from search results\n"
        "   d) Perform COMPREHENSIVE user fit analysis using all available information:\n"
        "      • User's conversation history and stated preferences\n"
        "      • User's profile data (email, notification preferences, opt-in status)\n"
        "      • Job requirements vs user's implied skills and experience\n"
        "      • Career progression opportunities and growth potential\n"
        "      • Work environment and culture fit based on conversation context\n"
        "   e) Create detailed, specific fit explanations that include:\n"
        "      • Specific skill matches and experience alignment\n"
        "      • Career development and growth opportunities\n"
        "      • Work environment and role suitability\n"
        "      • Why this job stands out for this user's profile\n"
        "   f) Save job recommendations using save_job_recommendations() with jobInformation parameter using EXACTLY this JSON structure:\n"
        "   [\n"
        "     {\n"
        "       \"id\": \"job_id\",\n"
        "       \"title\": \"job_title\",\n"
        "       \"description\": \"job_description\",\n"
        "       \"company\": \"company_name\",\n"
        "       \"salary_max\": \"max_salary\",\n"
        "       \"salary_min\": \"min_salary\",\n"
        "       \"fit\": \"why_user_is_good_fit\",\n"
        "       \"location\": \"city, state\",\n"
        "       \"type\": \"employment_type\",\n"
        "       \"industry\": \"industry_name\",\n"
        "       \"deadline\": \"expiration_date\",\n"
        "       \"remote\": \"yes/no\",\n"
        "       \"experience\": \"experience_level\"\n"
        "     }\n"
        "   ]\n"
        "3) Return ONLY success/failure message - DO NOTHING ELSE\n\n"
        "PERFORMANCE CONSTRAINTS:\n"
        "• LIMIT retrieve tool calls to MAXIMUM 2-3 times per preferred job role\n"
        "• Prioritize quality over quantity of search results\n"
        "• Focus on most relevant job matches for user's profile\n"
        "• Complete search efficiently within performance limits\n\n"
        "MANDATORY RESPONSE FORMAT:\n"
        "• If no jobs found, return: []\n"
        "• START with [ and END with ]\n"
        "• Return ONLY success/failure message\n"
        "• Examples: 'Job recommendations saved successfully' or 'Error saving job recommendations'\n"
        "• DO NOT return JSON arrays or job details\n"
        "• DO NOT ask any questions\n"
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
    Retrieve short-term memory (conversation history) formatted as Strands Agent messages.
    
    Args:
        session_id: Session identifier
        email: User email for actor_id
        max_turns: Maximum number of recent conversation turns to retrieve
    
    Returns:
        List of message dictionaries in Strands format or empty list if none found
    """
    
    # Create sanitized actor_id
    if email:
        actor_id = sanitize_email_for_actor_id(email)
    elif session_id:
        actor_id = f"user_{session_id}"
    else:
        return []
    
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
            # Convert to Strands message format
            messages = []
            for turn in recent_turns:
                for message in turn:
                    role = message['role'].lower()
                    content = message['content']['text']
                    messages.append({
                        "role": role,
                        "content": [{"text": content}]
                    })
            print(f"Loaded {len(messages)} messages from conversation history")
            return messages
        else:
            return []
        
    except Exception as e:
        print(f"Failed to retrieve session history: {e}")
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
     # Conditionally include tools based on source
        base_tools = [retrieve, get_student_profile]
        if source == "batch":
            base_tools.remove(get_student_profile)
            base_tools.append(get_job_recommendations)
            base_tools.append(save_job_recommendations)

        # Combine all available tools
        tools = base_tools 

        # Select appropriate system prompt based on source
        if source == "batch":
            system_prompt = _get_batch_job_search_prompt()
        else:  # livesearch
            system_prompt = _get_live_job_search_prompt()

        # Create a specialized job search agent with updated system prompt
        job_search_agent = Agent(
            tools=tools,
            model=bedrock_model,
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
async def career_advice_agent_tool(query: str, session_id: str = "", email: str = "") -> AsyncIterator:
    """
    Specialized career advice agent that provides guidance on career development.
    
    Uses Strands Sub-Agent Streaming pattern: Yields SubAgentResult events that contain
    the career advice agent's streaming chunks, which the orchestrator can forward to frontend.

    Args:
        query: Career advice question or request for guidance
        email: User email for memory tracking
        session_id: Optional session identifier for conversation continuity

    Yields:
        SubAgentResult events wrapping career advice agent streaming events
        Final yield: Complete career advice response text
    """
    try:
        print("[CAREER ADVICE] Starting career advice agent with sub-agent streaming")
        
        # Get memory tools
        memory_tools = _get_memory_tools(session_id, email)

        # Combine all available tools
        tools = [retrieve, get_student_profile] + memory_tools

        # Create a specialized career advice agent
        career_advice_agent = Agent(
            name="Career Advice Specialist",
            tools=tools,
            model=bedrock_model,
            callback_handler=None,  # Suppress sub-agent's own output
            system_prompt=(
                "You are a specialized Career Advice Agent providing guidance on career development with memory access.\n\n"
                f"Available Tools:\n"
                f"• retrieve: Access career resources using knowledgeBaseId: '{CARRIER_RESOURCE_KB}'. Maximum 2-3 retrieve\n"
                "• Memory tools: Access conversation history, previous advice sessions, and stored preferences\n"
                "• get_student_profile: Check user profile\n"
                "MEMORY-AWARE CAREER GUIDANCE WORKFLOW:\n"
                "1) Review user's previous career advice sessions and stored preferences\n"
                "2) Analyze user's career goals and current situation in context of history\n"
                "3) Identify specific areas where guidance is needed, building on past discussions\n"
                "4) Search comprehensive career resources with personalized context\n"
                "5) Provide actionable advice considering user's career trajectory and past feedback\n"
                "6) Create step-by-step plans based on user's previous progress and preferences\n\n"
                "MEMORY INTEGRATION:\n"
                "• Always reference previous career advice sessions and user preferences\n"
                "• Consider user's career goals and objectives from stored information\n"
                "• Build on previous feedback and recommendations given\n"
                "• Remember user's progress and achievements from past interactions\n\n"
                "RESPONSE GUIDELINES:\n"
                "• CRITICAL: Limit all responses to maximum 200-300 words\n"
                "• Keep answers concise and avoid lengthy explanations unless user requests more details\n"
                "• Provide actionable, practical advice based on industry best practices\n"
                "• Cite relevant resources and provide step-by-step guidance when appropriate\n"
                "• Focus on helping users advance their careers and achieve their professional goals\n"
                "• Personalize all advice based on user's conversation history and stored preferences\n"
                "• Return comprehensive, helpful responses that directly address the user's query\n"
                "• Include specific examples, tips, and actionable steps whenever possible\n"
                "• Always end responses by asking if the user wants more details or has follow-up questions to go over in detail"
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

        # Stream from career advice agent and yield SubAgentResult events
        # The orchestrator will receive these as tool_stream_event
        result = None
        async for event in career_advice_agent.stream_async(enhanced_query):
            # Yield every event wrapped in SubAgentResult
            yield SubAgentResult(agent=career_advice_agent, event=event)
            
            # Capture the final result
            if "result" in event:
                result = event["result"]
        
        # Final yield: return the complete response
        yield str(result) if result else "Career advice completed"

    except Exception as e:
        print(f"[CAREER ADVICE] Error: {e}")
        yield f"Error in career advice agent: {str(e)}"


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
        tools = [job_search_agent_tool, career_advice_agent_tool, get_student_profile] + memory_tools

        # Get conversation history for livesearch
        conversation_messages = []
        if source == "livesearch":
            conversation_messages = _get_session_history(session_id, email)

        self.orchestrator_agent = Agent(
            tools=tools,
            model=bedrock_model,
            messages=conversation_messages,
            system_prompt=(
                "You are an Orchestrator Agent for a Career Services platform with full memory access.\n\n"
                "Available Agents:\n"
                "• job_search_agent_tool: job search and job recommendations\n"
                "• career_advice_agent_tool: career guidance and professional development\n"
                "• get_student_profile: Check user profile and preferences\n"
                "• Memory tools: Access conversation history, preferences, and stored user information (read-only)\n\n"
                "INTENT RECOGNITION - FIRST STEP FOR ALL QUERIES:\n"
                "1) Analyze the user's intent before taking any action:\n"
                "   • GREETINGS: 'hello', 'hi', 'hey', 'good morning', etc. → Respond with friendly greeting, ask how you can help\n"
                "   • CASUAL CONVERSATION: General chat, thanks, goodbye → Respond naturally without triggering tools\n"
                "   • JOB SEARCH: requests for jobs, positions, opportunities → Use job search workflow\n"
                "   • CAREER ADVICE: Questions about career development, skills, guidance → Use career advice workflow\n"
                "2) For ambiguous queries, ask for clarification rather than assuming intent\n\n"
                "GREETING AND CASUAL INTERACTION RESPONSES:\n"
                "• FIRST check RECENT conversation history for immediate context - if user just had an ongoing conversation about job search/career advice, continue that conversation rather than resetting to generic greeting\n"
                "• Respond warmly to greetings: 'Hello! I'm here to help you with job searches and career advice. What can I assist you with today?'\n"
                "• For casual conversation, respond naturally without using tools\n"
                "• Only mention available services (job search, career advice) when appropriate\n"
                "• Do not automatically start job searches or retrieve profiles for greetings\n\n"
                "GUIDED QUERY STRUCTURE - FOR CAREER ADVICE OR JOB SEARCH ONLY:\n"
                "1) Review conversation history to understand what information the user has already provided - do this silently\n"
                "2) Check memory for user's job search history/preferences silently to enrich queries\n"
                "3) Identify what key details are missing based on previous context (major, skills, industry, location, etc.)\n"
                "4) ONLY respond with follow-up questions when the query is truly generic and needs clarification\n"
                "PERSONALIZED JOB SEARCH WORKFLOW - ONLY FOR EXPLICIT JOB SEARCH REQUESTS:\n"
                "1) Retrieve profile preferences using get_student_profile and memory tools\n"
                "2) Ask about specific preferences(exact city/location, job type, company size, remote vs onsite modality), ensure profile completeness, confirm with user before proceeding to showcase job results\n"
                "   - For confirming with user: Share what you found via profile and memory tools, mention the specific questions you should ask based on the above point (if any), and ask if they would like to change any preferences before proceeding with job search\n"
                "3) Enrich job search query with user's profile (skills, experience, locations, salary expectations)\n"
                "4) Call job_search_agent_tool with enhanced query and source parameter\n\n"
                "QUERY SPECIFICITY GUIDANCE:\n"
                "• Good queries: 'Find me data analyst jobs in Phoenix using my Python and SQL skills'\n"
                "• Generic queries: 'What jobs can I get?' → Ask: 'What field interests you most within your major?'\n"
                "• Use conversation history to fill in gaps: If user previously said they're a CS major with Python skills,\n"
                "  and now asks 'jobs in Seattle', combine this with existing context for a complete search\n\n"
                "ROUTING PRINCIPLES:\n"
                "• Greetings and casual conversation → Handle directly with friendly responses\n"
                "• Job search queries → retrieve preferences → job_search_agent_tool\n"
                "• Career advice queries → retrieve preferences → career_advice_agent_tool directly\n"
                "RESPONSE HANDLING - SILENT ROUTING FOR SPECIFIC QUERIES:\n"
                "• For GREETINGS: Respond directly without using tools\n"
                "• For SPECIFIC queries: Route to specialized agents SILENTLY - no orchestrator response needed\n"
                "• For GENERIC queries: Ask targeted follow-up questions using conversation history context\n"
                "• CALL each specialized agent only ONCE per query\n"
                "• WAIT for the tool execution to complete\n"
                "• When routing to agents: Respond with: 'Here are the job results' or 'Career Agent replied'\n"
                "• DO NOT pass through or return the full agent responses\n"
                "• DO NOT interpret, modify, or reformat any responses from specialized agents\n"
                "• The specialized agents handle all response formatting and user interaction directly\n"
                "• Only respond with error messages if tool execution fails or questions when clarification is needed\n"
                "• Keep responses concise but helpful - ask only the questions needed to make the query actionable\n"
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

    # Clear any previous sources from other requests (runtime dies after each query)
    clear_current_request_sources()

    try:
        # Initialize the multi-agent orchestrator system with memory support
        orchestrator_system = MultiAgentJobSearchSystem(session_id=session_id, email=email, source=source)

        # Store user message in memory before processing
        if session_id or email:
            _create_memory_event("USER", prompt, session_id, email)

        # Add session and email context if available
        context_parts = []
        if session_id:
            context_parts.append(f"Session: {session_id}")
        if email:
            context_parts.append(f"User: {email}")
        context_parts.append(f"Source: {source}")

        enhanced_prompt = f"Current User Query: {prompt}\n[Context: {' | '.join(context_parts)}]"

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
            return

        # Stream the response from the orchestrator agent
        final_response = ""
        job_search_thinking_sent = False  # Flag to prevent duplicate thinking messages
        carrier_advice_thinking_sent = False  # Flag to prevent duplicate thinking messages
        job_search_started = False  # Track if job search was initiated
        carrier_advice_started = False  # Track if career advice was initiated
        job_results_received = False  # Track if job results were received
        career_advice_result_sent = False  # Track if career advice result was sent

        try:
            async for event in orchestrator_system.orchestrator_agent.stream_async(enhanced_prompt):
                try:
                    # Handle sub-agent streaming events (career advice tool streaming)
                    tool_stream = event.get("tool_stream_event", {}).get("data")
                    if isinstance(tool_stream, SubAgentResult):
                        # Extract the sub-agent's event
                        sub_event = tool_stream.event
                        
                        # Forward data chunks from career advice agent to frontend
                        if "data" in sub_event:
                            chunk = sub_event["data"]
                            # Skip thinking tags
                            if "<thinking>" not in chunk and "</thinking>" not in chunk:
                                yield {"carrier_advice_streaming": chunk}
                        
                        # Skip other sub-agent events (reasoning, tool calls, etc.)
                        continue
                    
                    # Real-time text generation (thinking process from orchestrator)
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
                                                career_advice_result_sent = True

                    # Tool usage information - show the streaming tool input being built
                    elif "current_tool_use" in event:
                        tool_info = event["current_tool_use"]
                        if "name" in tool_info:
                            # Special thinking message for job search agent (send only once)
                            if tool_info["name"] == "job_search_agent_tool" and not job_search_thinking_sent:
                                yield {"job_search_started": True}
                                job_search_started = True  # Track that job search was initiated
                                job_search_thinking_sent = True  # Set flag to prevent duplicate messages
                            # Special thinking message for career advice agent (send only once)
                            elif tool_info["name"] == "career_advice_agent_tool" and not carrier_advice_thinking_sent:
                                yield {"carrier_advice_started": True}
                                carrier_advice_started = True  # Track that career advice was initiated
                                carrier_advice_thinking_sent = True  # Set flag to prevent duplicate messages

                    # Error events
                    elif "error" in event:
                        yield {"error": event["error"]}
                                            
                except Exception as stream_event_error:
                    # Catch any errors in processing individual streaming events
                    print(f"[ERROR] Error processing streaming event: {stream_event_error}")
                    print(f"[ERROR] Problematic event: {event}")
                    # Continue processing instead of crashing the entire stream
                    continue
        
        except Exception as streaming_error:
            print(f"[ERROR] Error in streaming loop: {streaming_error}")
            # Don't re-raise, let the outer exception handler deal with it

        # Yield sources after career advice if career advice was provided
        if career_advice_result_sent:
            try:
                top_sources = get_top_sources_for_current_request(limit=5)
                if top_sources:
                    yield {"sources": top_sources}
            except Exception as sources_error:
                print(f"[ERROR] Error getting sources: {sources_error}")
                # Continue without sources rather than failing

        # Store assistant response in memory and yield final result
        if final_response:
            try:
                if session_id or email:
                    _create_memory_event("ASSISTANT", final_response, session_id, email)
                yield {"final_result": final_response}
            except Exception as final_error:
                print(f"[ERROR] Error in final processing: {final_error}")
                # Still yield the result even if memory storage fails
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
