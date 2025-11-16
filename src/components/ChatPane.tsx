/*
    messages display, composer, send
*/

import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import type { Message } from "../types";

export default function ChatPane({ threadId, presetAppend }: { threadId: string; presetAppend?: string }) {
  const [store, setStore] = useState(load());
  const [input, setInput] = useState("");
  const messages = store.messages.filter(m => m.threadId === threadId);

  useEffect(() => {
    if (presetAppend) setInput(prev => `${prev}${prev ? "\n" : ""}${presetAppend}`);
  }, [presetAppend]);

  function addMessage(role: "user"|"assistant", content: string) {
    const m: Message = { id: crypto.randomUUID(), threadId, role, content, createdAt: Date.now() };
    const next = { ...store, messages: [...store.messages, m] };
    setStore(next); save(next);
  }

  async function send() {
    if (!input.trim()) return;
    addMessage("user", input);
    setInput("");
    addMessage("assistant", "Mock response. Backend coming soon!");
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {messages.map(m => (<div key={m.id}><strong>{m.role}:</strong> {m.content}</div>))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '8px', borderTop: '1px solid #eee' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, resize: 'none', height: '80px' }}
        />
        <button onClick={send} style={{ height: '40px' }}>Send</button>
      </div>
    </div>
  );
}
