import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { getUserEmail } from '../utils/cookieUtils';

// Session management utility
const SESSION_STORAGE_KEY = 'agentic_job_search_session_id';

export function getOrCreateSessionId(): string {
  // Check if we already have a session ID in sessionStorage
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionId) {
    // Generate a new session ID if one doesn't exist
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 16);
    sessionId = `session_${timestamp}_${randomString}`;

    // Store it in sessionStorage so it persists across page interactions
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

export function clearSessionId(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

interface StreamingCallbacks {
  onThinking?: (thinking: string) => void;
  onJobSearchStarted?: () => void;
  onCareerAdviceStarted?: () => void;
  onJobResults?: (jobs: any[], responseText: string) => void;
  onCareerAdvice?: (advice: string) => void;
  onResponse?: (response: string) => void;
  onError?: (error: string) => void;
}

export async function invokeAgent(
  message: string,
  callbacks?: StreamingCallbacks
): Promise<void> {
  try {
    const client = new BedrockAgentCoreClient({
      region: process.env.REACT_APP_AWS_REGION!,
      credentials: {
        accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY!,
      },
    });

    // Use persistent session ID for consistency across interactions
    const runtimeSessionId = getOrCreateSessionId();

    // Get user email if available
    const userEmail = getUserEmail();

    const payload: any = {
      prompt: message,
      session_id: runtimeSessionId,
      source: "livesearch"
    };

    // Include email if user has provided it
    if (userEmail) {
      payload.email = userEmail;
    }

    const input = {
      runtimeSessionId: runtimeSessionId,
      agentRuntimeArn: process.env.REACT_APP_AGENT_RUNTIME_ARN!,
      qualifier: process.env.REACT_APP_AGENT_QUALIFIER || "DEFAULT",
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    };

    const command = new InvokeAgentRuntimeCommand(input);
    const response = await client.send(command);
    
    // Handle streaming response
    if (response.response) {
      try {
        const textResponse = await response.response.transformToString();
        console.log('Raw agent response:', textResponse);
        
        // Parse the streaming response
        const lines = textResponse.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Handle thinking process
              if (data.thinking && callbacks?.onThinking) {
                callbacks.onThinking(data.thinking);
              }
              
              // Handle job search started
              if (data.job_search_started === true && callbacks?.onJobSearchStarted) {
                callbacks.onJobSearchStarted();
              }
              
              // Handle career advice started
              if (data.carrier_advice_started === true && callbacks?.onCareerAdviceStarted) {
                callbacks.onCareerAdviceStarted();
              }
              
              // Handle job results
              if (data.job_agent_result && callbacks?.onJobResults) {
                try {
                  let jobData: any[] = [];
                  let cleanJobResult = data.job_agent_result.trim();
                  
                  // Find the JSON array in the string
                  const jsonMatch = cleanJobResult.match(/(\[[\s\S]*?\])/);
                  if (jsonMatch) {
                    cleanJobResult = jsonMatch[1];
                  }
                  
                  jobData = JSON.parse(cleanJobResult);
                  callbacks.onJobResults(jobData, data.response || "Here are your job recommendations:");
                } catch (error) {
                  console.error('Error parsing job data:', error);
                  if (callbacks?.onError) {
                    callbacks.onError("Sorry, I'm having trouble processing the job results. Please try again later.");
                  }
                }
              }
              
              // Handle career advice results
              if (data.carrier_advice_result && callbacks?.onCareerAdvice) {
                callbacks.onCareerAdvice(data.carrier_advice_result);
              }
              
              // Handle regular response
              if (data.response && callbacks?.onResponse) {
                callbacks.onResponse(data.response);
              }
              
              // Handle final result
              if (data.final_result && callbacks?.onResponse) {
                callbacks.onResponse(data.final_result);
              }
              
              // Handle errors
              if (data.error && callbacks?.onError) {
                callbacks.onError(data.error);
              }
              
            } catch (error) {
              console.log('Error parsing streaming data:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error processing response:', error);
        if (callbacks?.onError) {
          callbacks.onError('Error processing response');
        }
      }
    }
  } catch (error) {
    console.error('Agent invocation failed:', error);
    if (callbacks?.onError) {
      callbacks.onError('I apologize, but I\'m having trouble connecting to the agent service right now. Please try again later.');
    }
  }
}
