import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

export async function invokeAgent(
  message: string,
  sessionId = 'default-session',
  opts?: { onToken?: (chunk: string) => void; signal?: AbortSignal }
): Promise<string> {
  try {
    const client = new BedrockAgentCoreClient({
      region: process.env.REACT_APP_AWS_REGION!,
      credentials: {
        accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY!,
      },
    });

    const runtimeSessionId = `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 15)}`;
    
    const payload = {
      prompt: message,
      session_id: sessionId,
      source: "livesearch"
    };

    const input = {
      runtimeSessionId: runtimeSessionId,
      agentRuntimeArn: process.env.REACT_APP_AGENT_RUNTIME_ARN!,
      qualifier: process.env.REACT_APP_AGENT_QUALIFIER || "DEFAULT",
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    };

    const command = new InvokeAgentRuntimeCommand(input);
    const response = await client.send(command);
    const textResponse = await response.response?.transformToString();
    
    console.log('Raw agent response:', textResponse);
    
    // Return the full response so ChatBotPage can detect job_search_started
    return textResponse?.trim() || 'No response from agent';
  } catch (error) {
    console.error('Agent invocation failed:', error);
    return 'I apologize, but I\'m having trouble connecting to the agent service right now. Please try again later.';
  }
}
