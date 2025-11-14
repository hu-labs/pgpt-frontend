/*
    messages display, composer, send
*/

import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import { Message } from "../types";

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
    <div>
      <div>
        {messages.map(m => (<div key={m.id}><strong>{m.role}:</strong> {m.content}</div>))}
      </div>
      <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Type a message..." />
      <button onClick={send}>Send</button>
    </div>
  );
}
