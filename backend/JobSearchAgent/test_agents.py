#!/usr/bin/env python3
"""
Test script for StrandsAgents - verifies environment and runs a simple job search
"""

import asyncio
import json
import os
from dotenv import load_dotenv
from StrandsAgents import handle_agent_request

# Load environment variables
load_dotenv()

async def test_job_search():
    """Test the job search functionality"""
    
    # Test payload
    test_payload = {
        "prompt": "Yes, I want daily notifications",
        "session_id": "session_hrud_12345",
        "email": "hrudapabbietty@gmail.com",
        "source": "livesearch"
    }
    
    print("Testing StrandsAgents with payload:")
    print(json.dumps(test_payload, indent=2))
    print("\n" + "="*50 + "\n")
    
    try:
        async for event in handle_agent_request(test_payload):
            if "thinking" in event:
                print(f"🤔 Thinking: {event['thinking']}")
            elif "response" in event:
                print(f"📝 Response: {event['response']}")
            elif "job_agent_result" in event:
                print(f"💼 Job Results: {event['job_agent_result']}")
            elif "error" in event:
                print(f"❌ Error: {event['error']}")
            elif "final_result" in event:
                print(f"✅ Final: {event['final_result']}")
            else:
                print(f"📊 Event: {event}")
                
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting StrandsAgents test...")
    asyncio.run(test_job_search())