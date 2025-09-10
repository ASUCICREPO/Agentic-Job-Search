import { useState } from 'react';
import { invokeAgent } from '../services/agentService';

export default function AgentChat() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    const idx = messages.length + 1;
    const final = await invokeAgent(text, 'default-session', {
      onToken: (chunk) =>
        setMessages((m) => {
          const copy = [...m];
          copy[idx] = { role: 'assistant', content: (copy[idx]?.content || '') + chunk };
          return copy;
        }),
    });

    setMessages((m) => {
      const copy = [...m];
      copy[idx] = { role: 'assistant', content: final };
      return copy;
    });
  };

  return (
    <div>
      {messages.map((m, i) => (
        <p key={i}><b>{m.role}:</b> {m.content}</p>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
