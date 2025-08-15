#!/usr/bin/env python3
"""
Job Search Agent using Strands with built-in retrieve function tooling.
This agent helps users find relevant job opportunities by querying knowledge bases.
"""

import json
from typing import Any, Dict

from strands import Agent
from strands_tools import retrieve
from bedrock_agentcore.runtime import BedrockAgentCoreApp

class JobSearchAgent:
    """
    Career Job Search Agent that uses retrieve function tooling to search knowledge bases.
    Enhanced with resume context support for personalized job recommendations.
    """
    
    def __init__(self):
        # Initialize Strands agent with retrieve tool - let Claude handle everything
        self.agent = Agent(
            tools=[retrieve],
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
                "Style: concise, bullet‑first, official links, recent postings only; group and rank best matches first.\n"
                "Tool usage: Use retrieve for job search; degrade gracefully if tools unavailable.\n"
                "Safety: No chain‑of‑thought; concise reasoning only; use only user‑provided information and resume content."
            )
        )
    
    def chat(self, message: str) -> str:
        """
        Process user message and return agent response.
        Let Claude handle all the workflow logic.
        """
        return self.agent(message)
    
    def chat_with_resume(self, message: str, resume_text: str) -> str:
        """
        Process user message with resume text context.
        
        Args:
            message: User's job search query
            resume_text: Pre-extracted resume content as text
            
        Returns:
            Agent's personalized response
        """
        full_message = f"""
Here is my resume content:
{resume_text}

Based on my resume, help me with:
{message}

Use the resume content to inform your job search queries with the retrieve function. Extract relevant skills, experience, and keywords from my resume to find the most suitable job opportunities.
"""
        return self.agent(full_message)



def handle_agent_request(payload):
    """
    Handle agent request from AWS Bedrock Agent Runtime.
    
    Expected payload format:
    {
        "prompt": "Find me software engineering jobs in the Bay Area",
        "resume_text": "John Doe\nSoftware Engineer..."  # optional
    }
    
    Args:
        payload: Request payload from AWS Bedrock Agent Runtime
        
    Returns:
        Agent response string
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
    
    agent = JobSearchAgent()
    
    try:
        # Handle resume text if provided
        if resume_text:
            # Use resume context for job search
            response = agent.chat_with_resume(prompt, resume_text)
        else:
            # Use general chat without resume
            response = agent.chat(prompt)
            
        return response
        
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        print(error_msg)
        return error_msg

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    AgentCore entrypoint for Bedrock Agent Core deployment.
    
    This is the entry point that AgentCore calls when the agent is invoked.
    
    Args:
        payload: Request payload containing prompt and optional parameters
        
    Returns:
        AgentCore-compatible response dictionary
    """
    try:
        # Process the request
        response = handle_agent_request(payload)
        
        return {
            "result": {
                "message": str(response),
                "stop_reason": "complete"
            }
        }
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
	app.run()