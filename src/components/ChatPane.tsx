/*
    messages display, composer, send
*/

import { useEffect, useState } from "react";
import { load, save } from "../lib/storage";
import type { Message } from "../types";

export default function ChatPane({
  threadId,
  presetAppend,
  presetTrigger,
  onFocus,
}: {
  threadId: string,
  presetAppend?: string,
  presetTrigger: number, // Trigger for the preset use
  onFocus?: () => void
}) {
  const [store, setStore] = useState(load());
  const [inputs, setInputs] = useState<Record<string, string>>({}); // 1 user input per threadId

  const messages = store.messages.filter((m) => m.threadId === threadId);

  useEffect(() => {
    // Ensure there's an input entry for the current threadId
    if (!inputs[threadId]) {
      setInputs((prev) => ({
        ...prev,
        [threadId]: "", // Initialize input for the new threadId if not already set
      }));
    }
  }, [threadId]);

  // NOTE: the space is added here before the preset text.
  useEffect(() => {
    if (presetAppend) {
      /*
      setInputs((prev) => ({
        ...prev,
        [threadId]: `${prev[threadId] || ""}${prev[threadId] ? "\n" : ""}${presetAppend}`,
      }));*/
      setInputs((prev) => ({
        ...prev,
        [threadId]: `${prev[threadId] || ""}${prev[threadId] ? " " : ""}${presetAppend}`,
      }));
    }
  }, [presetTrigger]); // Listen for preset use trigger

  function addMessage(role: "user" | "assistant", content: string) {
    const m: Message = {
      id: crypto.randomUUID(),
      threadId,
      role,
      content,
      createdAt: Date.now(),
    };
    setStore((prev) => {
      const next = { ...prev, messages: [...prev.messages, m] };
      save(next);
      return next;
    });
  }

  async function send() {
    const input = inputs[threadId] || "";
    if (!input.trim()) return;

    // Add the user message to the store
    const userMessage: Message = {
      id: crypto.randomUUID(),
      threadId,
      role: "user",
      content: input,
      createdAt: Date.now(),
    };

    let threadMessages: { role: string; content: string }[] = [];

    // Need the user input to go into the stored messages before fetch()
    await new Promise<void>((resolve) => {
      setStore((prev) => {
        const next = { ...prev, messages: [...prev.messages, userMessage] };
        save(next);

        // Prepare the message array in threadMessages for fetch()
        threadMessages = next.messages
          .filter((m) => m.threadId === threadId)
          .map((m) => ({ role: m.role, content: m.content }));

        resolve(); // Ensure this step completes before proceeding
        return next;
      });
    });

    // Clear the input box for this thread
    setInputs((prev) => ({ ...prev, [threadId]: "" }));
    // TODO ?: Consider locking the send button here?

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
      if (data.errorType === "Sandbox.Timeout")
        addMessage("assistant", `⚠️ Error: Timed out.`);
    } catch (err: any) {
      console.error("Error during backend fetch:", err);
      addMessage("assistant", `⚠️ Error: Could not reach backend. ${err.message}`);
      return; // Exit early if the fetch fails
    }

    try {
      // Process the backend response
      const parsedBody =
        typeof data.body === "string" ? JSON.parse(data.body) : data.body;
      const assistantContent = parsedBody.assistant?.content;

      if (!assistantContent) {
        console.error("Assistant content is undefined or null.");
        addMessage(
          "assistant",
          `⚠️ Parse Error: Assistant content is undefined or null.`
        );
      } else {
        addMessage("assistant", assistantContent);
      }
    } catch (err: any) {
      // Show an error message in the chat
      addMessage(
        "assistant",
        `⚠️ Error: Failed to process backend response. ${err.message}`
      );
    }
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onFocus={onFocus} // Attach the onFocus handler to the main container
      tabIndex={-1} // Ensure the div can receive focus
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingTop: "8px",
          paddingRight: "20px",
          paddingBottom: "8px",
          paddingLeft: "30px",
        }}
        tabIndex={-1}
      >
        {messages.map((m) => (
          <div key={m.id}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          borderTop: "1px solid #eee",
          paddingTop: "8px",
          paddingRight: "18px",
          paddingBottom: "8px",
          paddingLeft: "18px",
        }}
      >
        <textarea
          className="chatTextArea"
          value={inputs[threadId] || ""}
          onChange={(e) =>
            setInputs((prev) => ({ ...prev, [threadId]: e.target.value }))
          }
          placeholder="Type a message..."
          style={{ flex: 1, resize: "none", height: "80px" }}
        />
        <button
          className="major-button"
          onClick={send}
          disabled={(inputs[threadId]?.trim().length || 0) === 0}
          style={{ alignSelf: "flex-start", padding: "10px 20px" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}