/*
    messages display, composer, send
*/

import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import type { Message } from "../types";

export default function ChatPane({
  threadId,
  presetAppend,
  onPresetApplied
}: {
  threadId: string;
  presetAppend?: string;
  onPresetApplied: () => void
})
{
  const [store, setStore] = useState(load());
  //const [input, setInput] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({}); // Store inputs by threadId
  const [localPreset, setLocalPreset] = useState<string | null>(null); // Local state for presetAppend
  const messages = store.messages.filter(m => m.threadId === threadId);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("threadId changed");
    }
    // Logic for when threadId changes
    if (!inputs[threadId]) {
      setInputs(prev => ({
        ...prev,
        [threadId]: "", // Initialize input for the new threadId if not already set
      }));
    }
  }, [threadId]);

  useEffect(() => {
    // Handle presetAppend changes
    if (presetAppend && presetAppend !== localPreset) {
      setInputs(prev => ({
        ...prev,
        [threadId]: `${prev[threadId] || ""}${prev[threadId] ? "\n" : ""}${presetAppend}`,
      }));
      setLocalPreset(presetAppend.trim()); // Track the last used preset
      onPresetApplied(); // Notify parent that preset has been used
    }
  }, [presetAppend, threadId, localPreset, onPresetApplied]);

  function addMessage(role: "user"|"assistant", content: string) {
    const m: Message = { id: crypto.randomUUID(), threadId, role, content, createdAt: Date.now() };
    const next = { ...store, messages: [...store.messages, m] };
    setStore(next);
    save(next);
  }

  async function send() {
    const input = inputs[threadId] || "";
    if (!input.trim()) return;

    addMessage("user", input);
    setInputs(prev => ({ ...prev, [threadId]: "" })); // Clear input for the current threadId
    addMessage("assistant", "Mock response. Backend coming soon!");
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {messages.map(m => (
          <div key={m.id}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '8px', borderTop: '1px solid #eee' }}>
        <textarea
          value={inputs[threadId] || ""}
          onChange={e => setInputs(prev => ({ ...prev, [threadId]: e.target.value }))}
          placeholder="Type a message..."
          style={{ flex: 1, resize: 'none', height: '80px' }}
        />
        {/*<button onClick={send} style={{ height: '40px' }}>Send</button>*/}
        <button
          onClick={send}
          //disabled={input.trim().length === 0}
          disabled={(inputs[threadId]?.trim().length || 0) === 0}
          style={{ height: '40px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}