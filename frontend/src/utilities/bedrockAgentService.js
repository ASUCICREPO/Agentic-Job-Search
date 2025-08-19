import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import { LOCAL_DEV_MODE } from "./constants";

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
  }

  async invokeAgentStreaming(inputText, resumeText, onChunk, onComplete, onError) {
    try {
      // Create the payload matching the Python implementation format
      const payload = {
        prompt: inputText,
        session_id: this.generateSessionId()
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
        runtimeSessionId: this.generateSessionId()
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

  generateSessionId() {
    // Generate a session ID that's at least 33 characters long
    const timestamp = Date.now().toString();
    const randomPart1 = Math.random().toString(36).substr(2, 10);
    const randomPart2 = Math.random().toString(36).substr(2, 10);
    const sessionId = `session_${timestamp}_${randomPart1}_${randomPart2}`;
    
    // Ensure it's at least 33 characters, pad if necessary
    return sessionId.length >= 33 ? sessionId : sessionId.padEnd(33, '0');
  }
}

const bedrockAgentService = new BedrockAgentService();
export default bedrockAgentService;
