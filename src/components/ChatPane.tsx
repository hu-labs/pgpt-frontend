/*
    messages display, composer, send
*/

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { load, save } from "../lib/storage";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";
import type { Message } from "../types";
import MarkdownMessage from "./MarkdownMessage";
import "./ChatPane.css";

/*
  SSE contract emitted by the backend (see backend-serverless-repo handler.js):
    event: delta  data: {"content": "..."}   - incremental assistant text
    event: done   data: {}                   - clean completion
    event: error  data: {"message": "..."}   - fatal failure, stream still ends after this
  If the stream ends without a "done" or "error" event, that itself signals a
  timeout/dropped connection (handled in send() below).
*/
type PendingReply = { content: string; status: "waiting" | "streaming" };

// Parses a fetch() response body as the backend's SSE stream.
async function* readSseEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = rawEvent.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!eventLine || !dataLine) continue; // ignore ": ping" heartbeat comments

      yield {
        event: eventLine.slice("event:".length).trim(),
        data: JSON.parse(dataLine.slice("data:".length).trim()),
      };
    }
  }
}

function AssistantMessage({ content }: { content: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="chat-message-assistant">
      <MarkdownMessage content={content} />
      <div className="message-actions">
        <button
          type="button"
          className="message-copy"
          onClick={() => copy(content)}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="chat-message-assistant" aria-label="Assistant is typing">
      <span className="typing-indicator">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

export default function ChatPane({
  threadId,
  presetAppend,
  presetTrigger,
  onFocus,
}: {
  threadId: string;
  presetAppend?: string;
  presetTrigger: number; // Trigger for the preset use
  onFocus?: () => void;
}) {
  const [store, setStore] = useState(load());
  const [inputs, setInputs] = useState<Record<string, string>>({}); // 1 user input per threadId
  const [pending, setPending] = useState<Record<string, PendingReply>>({}); // in-flight assistant reply per threadId; not persisted until it finishes
  const messageContainerRef = useRef<HTMLDivElement>(null); // Ref for the message display area

  const messages = store.messages.filter((m) => m.threadId === threadId);

  // threadId has changed. Maybe a new thread, or thread switching.
  useEffect(() => {
    setInputs((previousInputs) => {
      if (threadId in previousInputs) {
        return previousInputs; // Save the existing input if threadId already exists.
      }
      return { ...previousInputs, [threadId]: "" }; // Create an empty input for the threadId.
    });
  }, [threadId]);

  const appendPreset = useEffectEvent(() => {
    if (!presetAppend) return;
    setInputs((prev) => ({
      ...prev,
      // If user text exists, preserve it then add space before appending.
      [threadId]: `${prev[threadId] || ""}${prev[threadId] ? " " : ""}${presetAppend}`,
    }));
  });

  useEffect(() => {
    appendPreset();
  }, [presetTrigger]);

  const streamingContent = pending[threadId]?.content;
  useEffect(() => {
    // Scroll to the bottom
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop =
        messageContainerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]); // Also scroll as a streaming reply grows

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

    const clearPending = () =>
      setPending((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });

    setPending((prev) => ({
      ...prev,
      [threadId]: { content: "", status: "waiting" },
    }));

    let response: Response;
    try {
      // fetch() from the backend
      response = await fetch(`${import.meta.env.VITE_API_URL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          // Local DEBUG version will require the key.
          //"X-Api-Key": import.meta.env.VITE_API_KEY,
        },
        body: JSON.stringify({ threadId, messages: threadMessages }),
      });
    } catch (err) {
      const error = err as Error;
      clearPending();
      addMessage(
        "assistant",
        `⚠️ Error: Could not reach backend. ${error.message}`,
      );
      return; // Exit early if the fetch fails
    }

    if (!response.ok) {
      clearPending();
      if (response.status === 504) {
        addMessage("assistant", `⚠️ Error: Backend timed out (504).`);
        return;
      }
      addMessage(
        "assistant",
        `⚠️ Error: Backend error: ${response.status} ${response.statusText}`,
      );
      return;
    }
    if (!response.body) {
      clearPending();
      addMessage("assistant", "⚠️ Error: Backend response has no body.");
      return;
    }

    // Stream the reply in as it arrives; only commit it to the store once finished.
    let finalContent = "";
    let terminated = false; // true once a "done" or "error" event is seen
    try {
      for await (const { event, data } of readSseEvents(response.body)) {
        if (event === "delta") {
          finalContent += data.content ?? "";
          setPending((prev) => ({
            ...prev,
            [threadId]: { content: finalContent, status: "streaming" },
          }));
        } else if (event === "done") {
          terminated = true;
        } else if (event === "error") {
          finalContent += `${finalContent ? "\n\n" : ""}⚠️ Error: ${data.message}`;
          terminated = true;
        }
      }
    } catch (err) {
      const error = err as Error;
      finalContent += `${finalContent ? "\n\n" : ""}⚠️ Error: Lost connection to backend. ${error.message}`;
    }

    if (!terminated) {
      // Connection closed without a clean "done"/"error" - likely a timeout further upstream.
      finalContent += `${finalContent ? "\n\n" : ""}⚠️ Response interrupted (connection closed before finishing, possibly a timeout).`;
    }

    clearPending();
    addMessage(
      "assistant",
      finalContent || "⚠️ Error: Backend returned an empty response.",
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onFocus={onFocus} // Attach the onFocus handler to the main container
      tabIndex={-1} // Ensure the div can receive focus
    >
      {/* Message Display div */}
      <div
        ref={messageContainerRef}
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
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="chat-bubble chat-bubble-user">
              {m.content}
            </div>
          ) : (
            <AssistantMessage key={m.id} content={m.content} />
          ),
        )}
        {pending[threadId] &&
          (pending[threadId].content ? (
            <div className="chat-message-assistant">
              <MarkdownMessage content={pending[threadId].content} />
            </div>
          ) : (
            <TypingIndicator />
          ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          borderTop: "1px solid var(--color-border)",
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
          aria-label="Send message"
          style={{
            alignSelf: "flex-start",
            padding: "10px 15px",
            fontSize: "16px",
          }}
        >
          {/*▶*/}
          <svg width="22" height="22" viewBox="0 0 16 13" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
