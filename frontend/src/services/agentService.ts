import { getUserEmail } from '../utils/cookieUtils';
import { AGENT_PROXY_URL } from '../utils/constants';

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
  return new Promise(async (resolve, reject) => {
    try {
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

      try {
        const response = await fetch(AGENT_PROXY_URL!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            runtimeSessionId: runtimeSessionId,
            payload: payload
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            // Decode the chunk and append to buffer
            buffer += decoder.decode(value, { stream: true });

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
                    console.log('Job search started event received');
                    callbacks.onJobSearchStarted();
                  }

                  // Handle career advice started
                  if (data.carrier_advice_started === true && callbacks?.onCareerAdviceStarted) {
                    console.log('Career advice started event received');
                    callbacks.onCareerAdviceStarted();
                  }

                  // Handle job results
                  if (data.job_agent_result && callbacks?.onJobResults) {
                    console.log('Job agent result event received, processing...');
                    try {
                      let jobData: any[] = [];
                      let cleanJobResult = data.job_agent_result.trim();

                      // Find the JSON array in the string
                      const jsonMatch = cleanJobResult.match(/(\[[\s\S]*?\])/);
                      if (jsonMatch) {
                        cleanJobResult = jsonMatch[1];
                      }

                      jobData = JSON.parse(cleanJobResult);
                      console.log('Job search results from backend:', JSON.stringify(jobData, null, 2));
                      console.log('Calling onJobResults callback with', jobData.length, 'jobs');
                      callbacks.onJobResults(jobData, data.response || "Here are your job recommendations:");
                      console.log('onJobResults callback completed');
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
                    console.log('Sources received:', data.sources.length, 'sources');
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
                    console.log('Error event received:', data.error);
                    callbacks.onError(data.error);
                  }

                } catch (error) {
                  console.log('Error parsing streaming data:', error);
                }
              }
            }
          }

          // Process any remaining content in buffer
          if (buffer.trim()) {
            if (callbacks?.onFinalResult) {
              callbacks.onFinalResult(buffer.trim());
            }
          }

          resolve();

        } finally {
          reader.releaseLock();
        }

      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        if (callbacks?.onError) {
          callbacks.onError('Network error. Please check your connection and try again.');
        }
        reject(fetchError);
      }

    } catch (error) {
      console.error('Agent invocation failed:', error);
      if (callbacks?.onError) {
        callbacks.onError('I apologize, but I\'m having trouble connecting to the agent service right now. Please try again later.');
      }
      reject(error);
    }
  });
}