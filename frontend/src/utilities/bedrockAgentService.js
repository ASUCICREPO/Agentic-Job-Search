import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import { LOCAL_DEV_MODE } from "./constants";
import { v4 as uuidv4 } from 'uuid';
import { Cookies } from 'react-cookie';

class BedrockAgentService {
  constructor() {
    // Initialize the Bedrock AgentCore client
    const clientConfig = {
      region: process.env.REACT_APP_AWS_REGION || 'us-west-2'
    };

    // For local development, use environment variables for credentials
    if (LOCAL_DEV_MODE) {
      clientConfig.credentials = {
        accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || 'dummy-access-key',
        secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || 'dummy-secret-key',
        sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN // Optional
      };
    }
    // When deployed on Amplify, credentials will be provided automatically

    this.client = new BedrockAgentCoreClient(clientConfig);
    this.cookies = new Cookies();
    this.sessionIdCookieName = 'bedrock_agent_session_id';
  }

  async invokeAgentStreaming(inputText, resumeText, onChunk, onComplete, onError) {
    try {
      // Get or create session ID from cookie
      const sessionId = this.getOrCreateSessionId();
      
      // Create the payload matching the Python implementation format
      const payload = {
        prompt: inputText,
        session_id: sessionId
      };

      // Add resume text to payload if provided
      if (resumeText) {
        payload.resume_text = resumeText;
      }

      // Create the InvokeAgentRuntimeCommand matching the Python implementation
      const command = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: process.env.REACT_APP_AGENT_RUNTIME_ARN,
        qualifier: process.env.REACT_APP_AGENT_QUALIFIER || "DEFAULT",
        payload: new TextEncoder().encode(JSON.stringify(payload)),
        contentType: 'application/json',
        accept: 'application/json',
        runtimeSessionId: sessionId
      });

      // Send the command and get the response
      const response = await this.client.send(command);

      // Handle the streaming response
      if (response.response) {
        const reader = response.response.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          // Convert the chunk to text
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines (data: {...})
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            // Parse the streaming response format: data: {...}
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6); // Remove 'data: ' prefix
                const data = JSON.parse(jsonStr);
                
                // Handle different types of streaming events
                if (data.thinking) {
                  onChunk({ type: 'thinking', content: data.thinking });
                } else if (data.tool_name) {
                  onChunk({ 
                    type: 'tool_use', 
                    tool_name: data.tool_name, 
                    tool_input: data.tool_input 
                  });
                } else if (data.response) {
                  onChunk({ type: 'response', content: data.response });
                } else if (data.final_result) {
                  onChunk({ type: 'final_result', content: data.final_result });
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming chunk:', parseError, line);
              }
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      console.error('Error invoking Bedrock Agent:', error);
      onError(error);
    }
  }

  getOrCreateSessionId() {
    // Try to get existing session ID from cookie
    let sessionId = this.cookies.get(this.sessionIdCookieName);
    
    if (!sessionId) {
      // Generate a new UUID-based session ID
      sessionId = `session_${uuidv4()}`;
      
      // Store in cookie with 24 hour expiration
      const expires = new Date();
      expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
      
      this.cookies.set(this.sessionIdCookieName, sessionId, {
        expires: expires,
        path: '/',
        secure: window.location.protocol === 'https:',
        sameSite: 'lax'
      });
    }
    
    return sessionId;
  }

  clearSession() {
    // Method to clear the session cookie if needed
    this.cookies.remove(this.sessionIdCookieName, { path: '/' });
  }
}

const bedrockAgentService = new BedrockAgentService();
export default bedrockAgentService;
