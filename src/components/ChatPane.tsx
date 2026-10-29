/* Displays authoritative messages, per-thread drafts, and temporary streaming replies. */

import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { sendChat } from "../lib/api";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";
import type { Message } from "../types";
import controls from "./Controls.module.css";
import styles from "./ChatPane.module.css";

type PendingReply = {
  userContent: string;
  assistantContent: string;
  status: "waiting" | "streaming";
};

interface ChatPaneProps {
  threadId: string | null;
  threadIds: string[];
  messages?: Message[];
  isLoadingMessages?: boolean;
  presetAppend?: string;
  presetTrigger: number;
  onFocus?: () => void;
  onRefreshMessages: (threadId: string) => Promise<Message[]>;
  onRefreshThreads: () => Promise<unknown>;
  onEditMessage: (
    threadId: string,
    messageId: string,
    content: string,
  ) => Promise<void>;
  onDeleteMessage: (threadId: string, messageId: string) => Promise<void>;
  onError: (error: unknown, fallback: string) => void;
  onActiveChange: (threadId: string, active: boolean) => void;
}

// Parse the backend's heartbeat-tolerant SSE response one complete event at a time.
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
      if (!eventLine || !dataLine) continue;

      yield {
        event: eventLine.slice("event:".length).trim(),
        data: JSON.parse(dataLine.slice("data:".length).trim()) as Record<
          string,
          unknown
        >,
      };
    }
  }
}

// Load Markdown and syntax highlighting only when assistant content is visible.
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

function TypingIndicator() {
  return (
    <div
      className={`${styles.assistantMessageBlock} ${styles.assistantMessage}`}
      aria-label="Assistant is typing"
    >
      <span className={styles.typingIndicator}>
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
        <span className={styles.typingDot} />
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  disabled,
  onEdit,
  onDelete,
}: {
  message: Message;
  disabled: boolean;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(message.content);
  const [isBusy, setIsBusy] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  async function saveEdit() {
    const content = editingContent.trim();
    if (!content || content === message.content) {
      if (content === message.content) setIsEditing(false);

      return;
    }

    setIsBusy(true);
    try {
      await onEdit(content);
      setIsEditing(false);
    } catch {
      // The workspace error banner reports the failure; keep editing for retry.
    } finally {
      setIsBusy(false);
    }
  }

  async function removeMessage() {
    setIsBusy(true);
    try {
      await onDelete();
    } catch {
      // The authoritative message remains visible and the workspace reports the failure.
      setIsBusy(false);
    }
  }

  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div
        className={`${styles.messageBlock} ${styles.assistantMessageBlock}`}
        data-message-role={message.role}
      >
        <div
          className={styles.assistantMessage}
          data-message-bubble="assistant"
        >
          <RenderedMarkdown content={message.content} />
        </div>
        <div
          className={`${styles.messageActions} ${styles.assistantMessageActions}`}
        >
          <button
            type="button"
            className={`${controls.button} ${styles.messageActionButton}`}
            onClick={() => copy(message.content)}
            aria-label="Copy message"
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? "✓" : "⧉"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.messageBlock} ${styles.userMessageBlock}`}
      data-message-role={message.role}
    >
      <div className={styles.userMessage} data-message-bubble="user">
        {isEditing ? (
          <textarea
            className={`${controls.field} ${styles.messageEditor}`}
            value={editingContent}
            onChange={(event) => setEditingContent(event.target.value)}
            aria-label="Edit message content"
            disabled={isBusy || disabled}
            autoFocus
          />
        ) : (
          <div className={styles.messageText}>{message.content}</div>
        )}
      </div>

      <div className={styles.messageActions}>
        <span className={styles.historyHint}>
          Edits and deletions do not regenerate later replies.
        </span>
        {isEditing ? (
          <>
            <button
              type="button"
              className={`${controls.button} ${styles.messageActionButton}`}
              onClick={() => void saveEdit()}
              disabled={disabled || isBusy || !editingContent.trim()}
              aria-label="Save edited message"
              title="Save"
            >
              ✓
            </button>
            <button
              type="button"
              className={`${controls.button} ${styles.messageActionButton}`}
              onClick={() => {
                setEditingContent(message.content);
                setIsEditing(false);
              }}
              disabled={isBusy}
              aria-label="Cancel editing message"
              title="Cancel"
            >
              X
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${controls.button} ${styles.messageActionButton} ${styles.historyAction}`}
              onClick={() => {
                setEditingContent(message.content);
                setIsEditing(true);
              }}
              disabled={disabled || isBusy}
              aria-label="Edit message"
              title="Edit"
            >
              ✎
            </button>
            <button
              type="button"
              className={`${controls.button} ${styles.messageActionButton} ${styles.historyAction}`}
              onClick={() => void removeMessage()}
              disabled={disabled || isBusy}
              aria-label="Delete message"
              title="Delete"
            >
              X
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatPane({
  threadId,
  threadIds,
  messages,
  isLoadingMessages = false,
  presetAppend,
  presetTrigger,
  onFocus,
  onRefreshMessages,
  onRefreshThreads,
  onEditMessage,
  onDeleteMessage,
  onError,
  onActiveChange,
}: ChatPaneProps) {
  // Keep drafts, pending replies, and transient notices isolated by thread.
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, PendingReply>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const requests = useRef(new Map<string, AbortController>());
  const notifyActive = useEffectEvent(onActiveChange);
  const knownThreadIds = threadIds.join("\u0000");

  // Abort and forget work only when its thread disappears; switching selection preserves it.
  useEffect(() => {
    const existing = new Set(
      knownThreadIds ? knownThreadIds.split("\u0000") : [],
    );

    for (const [id, controller] of requests.current) {
      if (!existing.has(id)) {
        controller.abort();
        requests.current.delete(id);
        notifyActive(id, false);
      }
    }
    const keepExisting = <T,>(previous: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => existing.has(id)),
      );

    setInputs(keepExisting);
    setPending(keepExisting);
    setNotices(keepExisting);
  }, [knownThreadIds]);

  // Account changes unmount this pane, cancelling every request before cache disposal.
  useEffect(
    () => () => {
      requests.current.forEach((controller, id) => {
        controller.abort();
        notifyActive(id, false);
      });

      requests.current.clear();
    },
    [],
  );

  // Append a selected preset to the current thread's draft without overwriting typed text.
  const appendPreset = useEffectEvent(() => {
    if (!threadId || !presetAppend) return;
    setInputs((previous) => ({
      ...previous,
      [threadId]: `${previous[threadId] || ""}${
        previous[threadId] ? " " : ""
      }${presetAppend}`,
    }));
  });

  useEffect(() => {
    appendPreset();
  }, [presetTrigger]);

  const streamingContent = threadId
    ? pending[threadId]?.assistantContent
    : undefined;

  // Follow newly loaded or streamed content while keeping the composer fixed.
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop =
        messageContainerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  async function refreshAfterInterruption(id: string) {
    await Promise.allSettled([onRefreshMessages(id), onRefreshThreads()]);
  }

  async function send() {
    if (
      !threadId ||
      requests.current.has(threadId) ||
      !threadIds.includes(threadId)
    ) {
      return;
    }
    const input = inputs[threadId] || "";
    if (!input.trim()) return;

    // Stage the user message and assistant placeholder without touching the persistent cache.
    const controller = new AbortController();
    requests.current.set(threadId, controller);
    onActiveChange(threadId, true);
    setInputs((previous) => ({ ...previous, [threadId]: "" }));
    setNotices((previous) => {
      const next = { ...previous };
      delete next[threadId];

      return next;
    });

    setPending((previous) => ({
      ...previous,
      [threadId]: {
        userContent: input,
        assistantContent: "",
        status: "waiting",
      },
    }));

    try {
      // Start the authenticated chat stream using only the new prompt and thread ID.
      const response = await sendChat(threadId, input, controller.signal);
      if (!response.ok) {
        throw new Error(`Backend request failed (${response.status}).`);
      }
      if (!response.body) throw new Error("Backend response has no body.");

      // Accumulate deltas only in temporary display state until the backend acknowledges persistence.
      let assistantContent = "";
      let completed = false;
      for await (const event of readSseEvents(response.body)) {
        if (controller.signal.aborted) return;
        if (event.event === "delta") {
          assistantContent += String(event.data.content ?? "");
          setPending((previous) => ({
            ...previous,
            [threadId]: {
              userContent: input,
              assistantContent,
              status: "streaming",
            },
          }));
        } else if (event.event === "done") {
          completed = true;
        } else if (event.event === "error") {
          throw new Error(String(event.data.message ?? "The response failed."));
        }
      }

      if (!completed) {
        throw new Error("The connection closed before the response finished.");
      }

      // Replace optimistic content with the exact messages and ordering stored by DynamoDB.
      const results = await Promise.allSettled([
        onRefreshMessages(threadId),
        onRefreshThreads(),
      ]);

      if (results.some((result) => result.status === "rejected")) {
        setNotices((previous) => ({
          ...previous,
          [threadId]:
            "The response completed, but the saved conversation could not be refreshed. Try Refresh.",
        }));
      }
    } catch (failure) {
      if (controller.signal.aborted) return;

      // Report interruption outside chat history, then reconcile whatever the backend did persist.
      const detail =
        failure instanceof Error ? failure.message : "Unknown error.";

      setNotices((previous) => ({
        ...previous,
        [threadId]: `Response interrupted. ${detail}`,
      }));

      await refreshAfterInterruption(threadId);
    } finally {
      // Clear temporary UI only if this is still the current request for the thread.
      if (requests.current.get(threadId) === controller) {
        requests.current.delete(threadId);
        onActiveChange(threadId, false);
        setPending((previous) => {
          const next = { ...previous };
          delete next[threadId];

          return next;
        });
      }
    }
  }

  if (!threadId) return null;
  const currentPending = pending[threadId];

  return (
    <div className={styles.pane} onFocus={onFocus} tabIndex={-1}>
      {notices[threadId] && (
        <div className={styles.notice} role="alert">
          <span>{notices[threadId]}</span>
          <button
            type="button"
            className={`${controls.button} ${styles.noticeAction}`}
            onClick={() => {
              void onRefreshMessages(threadId)
                .then(() => {
                  setNotices((previous) => {
                    const next = { ...previous };
                    delete next[threadId];

                    return next;
                  });
                })
                .catch((failure) => {
                  onError(failure, "Could not refresh the conversation.");
                });
            }}
          >
            Refresh
          </button>
        </div>
      )}

      <div ref={messageContainerRef} className={styles.messages} tabIndex={-1}>
        <div className={styles.contentColumn}>
          {isLoadingMessages && messages === undefined && (
            <p className={styles.loading}>Loading messages…</p>
          )}
          {(messages ?? []).map((message) => (
            <MessageBubble
              key={message.messageId}
              message={message}
              disabled={Boolean(currentPending)}
              onEdit={(content) =>
                onEditMessage(threadId, message.messageId, content)
              }
              onDelete={() => onDeleteMessage(threadId, message.messageId)}
            />
          ))}
          {currentPending && (
            <div
              className={`${styles.messageBlock} ${styles.userMessageBlock}`}
              data-message-role="user"
            >
              <div
                className={`${styles.userMessage} ${styles.pendingMessage}`}
                data-message-bubble="user"
              >
                <div className={styles.messageText}>
                  {currentPending.userContent}
                </div>
              </div>
            </div>
          )}
          {currentPending &&
            (currentPending.assistantContent ? (
              <div
                className={`${styles.assistantMessageBlock} ${styles.assistantMessage}`}
              >
                <RenderedMarkdown content={currentPending.assistantContent} />
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
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                [threadId]: event.target.value,
              }))
            }
            placeholder="Type a message..."
          />
          <button
            type="button"
            className={`${controls.button} ${controls.primary} ${styles.sendButton}`}
            onClick={() => void send()}
            disabled={
              Boolean(currentPending) ||
              (inputs[threadId]?.trim().length || 0) === 0
            }
            aria-label="Send message"
          >
            <svg width="22" height="22" viewBox="0 0 16 13" fill="currentColor">
              <path d="M4 2l10 6-10 6V2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
