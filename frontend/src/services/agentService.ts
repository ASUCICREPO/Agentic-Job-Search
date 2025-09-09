// Call your backend proxy for Bedrock Agent
const API_BASE = process.env.REACT_APP_API_BASE || '/api';

export async function invokeAgent(
  message: string,
  sessionId = 'default-session',
  opts?: { onToken?: (chunk: string) => void; signal?: AbortSignal }
): Promise<string> {
  const resp = await fetch(`${API_BASE}/agent/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
    signal: opts?.signal,
  });

  if (!resp.ok) throw new Error(`Invoke failed: ${resp.status}`);

  if (resp.body) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      opts?.onToken?.(chunk); // stream updates to UI
    }
    return full.trim() || 'No response';
  }

  return (await resp.text()).trim();
}
