#!/usr/bin/env python3
"""
Job Search Agent using Strands with built-in retrieve function tooling.
This agent helps users find relevant job opportunities by querying knowledge bases.
"""

import os
import base64
import uuid
import json
from typing import Any, Dict

# Set AWS profile for knowledge base access
# os.environ['AWS_PROFILE'] = 'jobsearch'
# os.environ['AWS_REGION'] = 'us-east-1'
# os.environ['KNOWLEDGE_BASE_ID'] = 'GFSQKJF1KV' 

from strands import Agent
from strands_tools import retrieve, file_read
from bedrock_agentcore.runtime import BedrockAgentCoreApp

class JobSearchAgent:
    """
    Career Job Search Agent that uses retrieve function tooling to search knowledge bases.
    Enhanced with resume context support for personalized job recommendations.
    """
    
    def __init__(self):
        # Initialize Strands agent with retrieve and file_read tools - let Claude handle everything
        self.agent = Agent(
            tools=[retrieve, file_read],
            system_prompt=(
                "You are a Career Job Search Agent for all fields/seniority.\n"
                "Available Tools:\n"
                "- retrieve: Query job information from Knowledge Base\n"
                "- file_read: Read resume documents (PDF, DOCX, etc.) in document mode\n\n"
                "Resume Processing:\n"
                "When user provides a resume file path, use file_read with mode='document' to read PDF/DOCX files.\n"
                "The file_read tool will automatically handle base64 encoding and document parsing.\n"
                "Analyze resume content to understand skills, experience, education, and career trajectory.\n\n"
                "Workflow:\n"
                "1) Resume Analysis: If resume provided, use file_read tool to read document and analyze background\n"
                "2) Company Recommendations: From resume keywords/interests, list 6–12 relevant companies (top‑tier + mission‑aligned). For each: Company — Why fit (1 line) — Careers URL.\n"
                "3) Job Search: Use retrieve function to query job information from Knowledge Base. Compose strong queries from resume skills/titles/domains and constraints. Output bullets: Title — Company — Location — Link — 1‑line rationale.\n"
                "4) Next Steps: Suggest concrete actions (tailoring, outreach/referrals, interview prep) and ask ONE precise follow‑up.\n\n"
                "Style: concise, bullet‑first, official links, recent postings only; group and rank best matches first.\n"
                "Tool usage: Use file_read for resume documents, retrieve for job search; degrade gracefully if tools unavailable.\n"
                "Safety: No chain‑of‑thought; concise reasoning only; use only user‑provided information and resume content."
            )
        )
    
    def chat(self, message: str) -> str:
        """
        Process user message and return agent response.
        Let Claude handle all the workflow logic.
        """
        return self.agent(message)
    
    def chat_with_resume(self, message: str, resume_file_path: str) -> str:
        """
        Process user message with resume file context.
        
        Args:
            message: User's job search query
            resume_file_path: Path to resume file (PDF, DOCX, etc.)
            
        Returns:
            Agent's personalized response
        """
        full_message = f"""
I have a resume file at: {resume_file_path}

Use the file_read tool with mode='document' to read my resume and extract my skills, experience, and keywords. Then directly help me with:
{message}

Use the resume content to inform your job search queries with the retrieve function. No need for resume analysis or summary - just use it as context for finding relevant jobs.
"""
        return self.agent(full_message)


def process_base64_resume(resume_base64: str, file_extension: str = "pdf") -> str:
    """
    Process base64 encoded resume and save to /tmp/ directory.
    
    Args:
        resume_base64: Base64 encoded resume content
        file_extension: File extension (pdf, docx, etc.)
        
    Returns:
        Path to the saved resume file in /tmp/
    """
    try:
        # Decode base64 content
        resume_bytes = base64.b64decode(resume_base64)
        
        # Generate unique filename
        unique_id = str(uuid.uuid4())[:8]
        filename = f"resume_{unique_id}.{file_extension}"
        file_path = os.path.join("/tmp", filename)
        
        # Write to /tmp/
        with open(file_path, "wb") as f:
            f.write(resume_bytes)
            
        print(f"✅ Resume saved to: {file_path}")
        return file_path
        
    except Exception as e:
        raise Exception(f"Error processing base64 resume: {str(e)}")


def handle_agent_request(payload):
    """
    Handle agent request from AWS Bedrock Agent Runtime.
    
    Expected payload format:
    {
        "prompt": "Find me software engineering jobs in the Bay Area",
        "resume_base64": "JVBERi0xLjQK...",  # optional
        "file_extension": "pdf"  # optional, defaults to pdf
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
    resume_base64 = payload.get("resume_base64")
    file_extension = payload.get("file_extension")
    
    agent = JobSearchAgent()
    resume_file = None
    
    try:
        # Handle base64 resume if provided
        if resume_base64:
            resume_file = process_base64_resume(resume_base64, file_extension)
            # Use resume context for job search
            response = agent.chat_with_resume(prompt, resume_file)
        else:
            # Use general chat without resume
            response = agent.chat(prompt)
            
        return response
        
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        print(error_msg)
        return error_msg
        
    finally:
        # Clean up temp file if it was created
        if resume_file and resume_file.startswith("/tmp/"):
            try:
                os.remove(resume_file)
            except:
                pass

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