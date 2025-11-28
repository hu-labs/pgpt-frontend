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
    //if (import.meta.env.DEV) console.log("threadId changed");
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
    setStore(prev=> {
      const next = { ...prev, messages: [...prev.messages, m] };
      save(next);
      return next;
    });
    //console.log("After save: ", store.messages.some(m => m.content === "Hello World"));
  }

  /*
    solution for the fetch closure in async send()
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);
  */

  async function send() {
    const input = inputs[threadId] || "";
    if (!input.trim()) return;

    // Step 1: Add the user message to the store
    const userMessage: Message = {
      id: crypto.randomUUID(),
      threadId,
      role: "user",
      content: input,
      createdAt: Date.now(),
    };

    let threadMessages: { role: string; content: string }[] = [];

    // Need the user input to go into the stored messages before fetch()
    await new Promise<void>(resolve => {
      setStore(prev => {
        const next = { ...prev, messages: [...prev.messages, userMessage] };
        save(next);

        // Save the newest message array in threadMessages for the later fetch()
        threadMessages = next.messages
          .filter(m => m.threadId === threadId)
          .map(m => ({ role: m.role, content: m.content }));

        resolve(); // Ensure this step completes before proceeding
        return next;
      });
    });

    // Clear the input box for this thread
    setInputs(prev => ({ ...prev, [threadId]: "" }));
    // Consider locking the send button here?

    let data: any;
    try {
      // fetch() from the backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({ threadId, messages: threadMessages }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      }

      data = await response.json();
      console.log("Backend response data:", data);
      if( data.errorType==="Sandbox.Timeout" )
        addMessage("assistant", `⚠️ Error: Timed out.`);
    } catch (err: any) {
      console.error("Error during backend fetch:", err);
      addMessage("assistant", `⚠️ Error: Could not reach backend. ${err.message}`);
      return; // Exit early if the fetch fails
    }

    try {
      // Process the backend response
      const parsedBody = typeof data.body === "string"
                        ? JSON.parse(data.body) : data.body;
      const assistantContent = parsedBody.assistant?.content;

      if (!assistantContent) {
        console.error("Assistant content is undefined or null.");
        addMessage("assistant", `⚠️ Parse Error: Assistant content is undefined or null.`);
      } else {
        addMessage("assistant", assistantContent);
      }
    } catch (err: any) {
      // Show an error message in the chat
      addMessage("assistant", `⚠️ Error: Failed to process backend response. ${err.message}`);
    }
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
        <button
          onClick={send}
          disabled={(inputs[threadId]?.trim().length || 0) === 0}
          style={{ height: '40px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}