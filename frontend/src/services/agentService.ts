import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import { getUserEmail } from '../utils/cookieUtils';

// Session management utility - generates new session ID on every page refresh
const SESSION_STORAGE_KEY = 'agentic_job_search_session_id';
const PAGE_LOAD_KEY = 'agentic_job_search_page_load_id';

// Store a unique page load identifier to detect page refreshes
let currentPageLoadId: string | null = null;

function generateSessionId(): string {
  const timestamp = Date.now();
  // Generate a longer random string to ensure we meet the 33 character minimum
  const randomString1 = Math.random().toString(36).substr(2, 16);
  const randomString2 = Math.random().toString(36).substr(2, 8);
  let sessionId = `session_${timestamp}_${randomString1}${randomString2}`;

  // Ensure the session ID meets the minimum length requirement
  if (sessionId.length < 33) {
    // Add more random characters if needed
    const additionalRandom = Math.random().toString(36).substr(2);
    sessionId += additionalRandom.substr(0, 33 - sessionId.length);
  }

  return sessionId;
}

export function getOrCreateSessionId(): string {
  // Generate a unique identifier for this page load
  const pageLoadId = Math.random().toString(36).substr(2, 15);
  
  // Check if this is a new page load (refresh or initial load)
  const storedPageLoadId = sessionStorage.getItem(PAGE_LOAD_KEY);
  const isNewPageLoad = !currentPageLoadId || currentPageLoadId !== storedPageLoadId;
  
  // Set current page load ID
  currentPageLoadId = pageLoadId;
  sessionStorage.setItem(PAGE_LOAD_KEY, pageLoadId);

  // Always generate a new session ID on page refresh or initial load
  if (isNewPageLoad) {
    const newSessionId = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
    console.log(`New session ID generated on page load: ${newSessionId}`);
    return newSessionId;
  }

  // For same-page interactions, use existing session ID
  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  
  // Fallback: if no session ID exists, generate a new one
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    console.log(`Fallback session ID generated: ${sessionId}`);
  }

  return sessionId;
}

export function clearSessionId(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(PAGE_LOAD_KEY);
  currentPageLoadId = null;
}

export function forceNewSessionId(): string {
  // Clear existing session data
  clearSessionId();
  // Generate and return new session ID
  return getOrCreateSessionId();
}

interface StreamingCallbacks {
  onThinking?: (thinking: string) => void;
  onJobSearchStarted?: () => void;
  onCareerAdviceStarted?: () => void;
  onJobResults?: (jobs: any[], responseText: string) => void;
  onCareerAdvice?: (advice: string) => void;
  onCareerAdviceStreaming?: (chunk: string) => void;  // Streaming chunks from career advice
  onResponse?: (response: string) => void;
  onFinalResult?: (result: string) => void;  // Final result indicating streaming complete
  onSources?: (sources: any[]) => void;
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

    console.log("using runtimeId" + runtimeSessionId)

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
            // Process the streaming response incrementally
            let buffer = '';

        // Use the streaming response body
        const stream = response.response.transformToWebStream();
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete lines from the buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

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

                  // Handle career advice streaming chunks (real-time)
                  if (data.carrier_advice_streaming && callbacks?.onCareerAdviceStreaming) {
                    callbacks.onCareerAdviceStreaming(data.carrier_advice_streaming);
                  }

                  // Handle career advice results (final complete response)
                  if (data.carrier_advice_result && callbacks?.onCareerAdvice) {
                    callbacks.onCareerAdvice(data.carrier_advice_result);
                  }

                  // Handle sources
                  if (data.sources && callbacks?.onSources) {
                    callbacks.onSources(data.sources);
                  }

                  // Ignore 'response' events - they duplicate 'thinking' events from orchestrator
                  // We only use 'thinking' for orchestrator streaming text

                  // Handle final result - indicates streaming is complete
                  if (data.final_result && callbacks?.onFinalResult) {
                    callbacks.onFinalResult(data.final_result);
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
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        console.error('Error processing streaming response:', error);
        if (callbacks?.onError) {
          callbacks.onError('Error processing streaming response');
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