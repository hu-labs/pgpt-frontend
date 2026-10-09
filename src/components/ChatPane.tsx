/*
    messages display, composer, send
*/

import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { getStore, subscribeStore, useStore } from "../lib/storage";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";
import { fetchAuthSession } from "aws-amplify/auth";

import type { Message } from "../types";

import controls from "./Controls.module.css";
import styles from "./ChatPane.module.css";

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

// Fetch Markdown parsing and syntax highlighting only when an assistant reply is shown.
const MarkdownMessage = lazy(() => import("./MarkdownMessage"));

function RenderedMarkdown({ content }: { content: string }) {
  return (
    <Suspense
      fallback={<div style={{ whiteSpace: "pre-wrap" }}>{content}</div>}
    >
      <MarkdownMessage content={content} />
    </Suspense>
  );
}

function AssistantMessage({ content }: { content: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className={styles.assistantMessage}>
      <RenderedMarkdown content={content} />
      <div className={styles.messageActions}>
        <button
          type="button"
          className={`${controls.button} ${styles.copyButton}`}
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
    <div className={styles.assistantMessage} aria-label="Assistant is typing">
      <span className={styles.typingIndicator}>
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
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
  threadId: string | null;
  presetAppend?: string;
  presetTrigger: number; // Trigger for the preset use
  onFocus?: () => void;
}) {
  const [store, setStore] = useStore();
  const [inputs, setInputs] = useState<Record<string, string>>({}); // 1 user input per threadId
  const [pending, setPending] = useState<Record<string, PendingReply>>({}); // in-flight assistant reply per threadId; not persisted until it finishes
  const messageContainerRef = useRef<HTMLDivElement>(null); // Ref for the message display area

  const messages = store.messages.filter((m) => m.threadId === threadId);

  const requests = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const controllers = requests.current;
    // Remove only deleted threads' requests/drafts, but preserve other chats.
    const unsubscribe = subscribeStore(() => {
      const exists = (id: string) =>
        getStore().threads.some((thread) => thread.id === id);
      for (const [id, controller] of controllers) {
        if (!exists(id)) {
          controller.abort();
          controllers.delete(id);
        }
      }
      setInputs((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => exists(id))),
      );
      setPending((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([id]) => exists(id))),
      );
    });
    return () => {
      unsubscribe();
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const appendPreset = useEffectEvent(() => {
    if (!threadId || !presetAppend) return;
    setInputs((prev) => ({
      ...prev,
      // If user text exists, preserve it then add space before appending.
      [threadId]: `${prev[threadId] || ""}${prev[threadId] ? " " : ""}${presetAppend}`,
    }));
  });

  useEffect(() => {
    appendPreset();
  }, [presetTrigger]);

  const streamingContent = threadId ? pending[threadId]?.content : undefined;
  useEffect(() => {
    // Scroll to the bottom
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop =
        messageContainerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]); // Also scroll as a streaming reply grows

  function addMessage(role: "user" | "assistant", content: string) {
    if (!threadId) return;
    const m: Message = {
      id: crypto.randomUUID(),
      threadId,
      role,
      content,
      createdAt: Date.now(),
    };
    setStore((prev) => {
      // Final guard against a reply or error arriving after its thread was deleted.
      if (!prev.threads.some((thread) => thread.id === threadId)) return prev;
      return { ...prev, messages: [...prev.messages, m] };
    });
  }

  async function send() {
    if (
      !threadId ||
      requests.current.has(threadId) ||
      !getStore().threads.some((thread) => thread.id === threadId)
    )
      return;
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

    const next = setStore((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));
    const threadMessages = next.messages
      .filter((message) => message.threadId === threadId)
      .map(({ role, content }) => ({ role, content }));
    const controller = new AbortController();
    requests.current.set(threadId, controller);
    // Aborting is best effort: ignore late results even if the response already arrived.
    const cancelled = () =>
      controller.signal.aborted ||
      !getStore().threads.some((thread) => thread.id === threadId);

    // Clear the input box for this thread
    setInputs((prev) => ({ ...prev, [threadId]: "" }));

    const clearPending = () => {
      requests.current.delete(threadId);
      setPending((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
    };

    setPending((prev) => ({
      ...prev,
      [threadId]: { content: "", status: "waiting" },
    }));

    let idToken: string | undefined;
    // Try-catch session lookup failure.
    try {
      // Cognito: get ID token.
      const session = await fetchAuthSession();
      idToken = session.tokens?.idToken?.toString();
    } catch {
      if (cancelled()) return;
      clearPending();
      addMessage(
        "assistant",
        "⚠️ Error: Could not verify your login session. Please log in again and retry.",
      );
      return;
    }

    // Deletion or unmount may have happened while session lookup was pending.
    if (cancelled()) return;
    if (!idToken) {
      // i.e. user is not logged in
      clearPending();
      addMessage(
        "assistant",
        "⚠️ Error: Please log in before sending a message.",
      );
      return;
    }

    // Request to the backend
    let response: Response;
    try {
      // fetch() from the backend
      response = await fetch(`${import.meta.env.VITE_API_URL}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${idToken}`, // Cognito Auth
          // Insert key if in local debug mode
          ...(import.meta.env.DEV && import.meta.env.VITE_API_KEY
            ? { "X-Api-Key": import.meta.env.VITE_API_KEY }
            : {}),
        },
        body: JSON.stringify({ threadId, messages: threadMessages }),
      });
    } catch (err) {
      if (cancelled()) return;
      const error = err as Error;
      clearPending();
      addMessage(
        "assistant",
        `⚠️ Error: Could not reach backend. ${error.message}`,
      );
      return; // Exit early if the fetch fails
    }

    if (cancelled()) return;
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

    // Stream the reply in as it arrives. Only commit it to the store once finished.
    let finalContent = "";
    let terminated = false; // true once a "done" or "error" event is seen
    try {
      for await (const { event, data } of readSseEvents(response.body)) {
        if (cancelled()) return;
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
      if (cancelled()) return;
      const error = err as Error;
      finalContent += `${finalContent ? "\n\n" : ""}⚠️ Error: Lost connection to backend. ${error.message}`;
    }

    if (cancelled()) return;
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

  if (!threadId) return null;

  return (
    <div
      className={styles.pane}
      onFocus={onFocus} // Attach the onFocus handler to the main container
      tabIndex={-1} // Ensure the div can receive focus
    >
      {/* Message Display div */}
      <div ref={messageContainerRef} className={styles.messages} tabIndex={-1}>
        <div className={styles.contentColumn}>
          {messages.map((m) =>
            m.role === "user" ? (
              <div
                key={m.id}
                className={styles.userMessage}
                data-message-role="user"
              >
                {m.content}
              </div>
            ) : (
              <AssistantMessage key={m.id} content={m.content} />
            ),
          )}
          {pending[threadId] &&
            (pending[threadId].content ? (
              <div className={styles.assistantMessage}>
                <RenderedMarkdown content={pending[threadId].content} />
              </div>
            ) : (
              <TypingIndicator />
            ))}
        </div>
      </div>
      <div className={styles.composer}>
        <div className={styles.composerInner}>
          <textarea
            className={`${controls.field} ${styles.composerInput}`}
            value={inputs[threadId] || ""}
            onChange={(e) =>
              setInputs((prev) => ({ ...prev, [threadId]: e.target.value }))
            }
            placeholder="Type a message..."
          />
          <button
            type="button"
            className={`${controls.button} ${controls.primary} ${styles.sendButton}`}
            onClick={send}
            disabled={
              !!pending[threadId] ||
              (inputs[threadId]?.trim().length || 0) === 0
            }
            aria-label="Send message"
          >
            {/*▶*/}
            <svg width="22" height="22" viewBox="0 0 16 13" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
