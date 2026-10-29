/* Owns the authenticated workspace's in-memory API cache and server-backed CRUD operations. */

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { Message, Preset, Thread } from "../types";

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.name !== "AbortError"
    ? `${fallback} ${error.message}`
    : fallback;

export function useConversations(enabled: boolean) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, Message[]>
  >({});

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState<
    Record<string, boolean>
  >({});

  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(false);
  const messagesRef = useRef(messagesByThread);
  const messageRequests = useRef(new Map<string, AbortController>());

  const cacheMessages = useCallback((threadId: string, messages: Message[]) => {
    setMessagesByThread((previous) => {
      const next = { ...previous, [threadId]: messages };
      messagesRef.current = next;

      return next;
    });
  }, []);

  const reportError = useCallback((failure: unknown, fallback: string) => {
    if (mounted.current) setError(errorText(failure, fallback));
  }, []);

  const refreshThreads = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await api.listThreads(signal);
        if (mounted.current && !signal?.aborted) setThreads(result.threads);

        return result.threads;
      } catch (failure) {
        if (!(failure instanceof Error && failure.name === "AbortError")) {
          reportError(failure, "Could not load conversations.");
        }
        throw failure;
      }
    },
    [reportError],
  );

  const refreshPresets = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await api.listPresets(signal);
        if (mounted.current && !signal?.aborted) setPresets(result.presets);

        return result.presets;
      } catch (failure) {
        if (!(failure instanceof Error && failure.name === "AbortError")) {
          reportError(failure, "Could not load prompt presets.");
        }
        throw failure;
      }
    },
    [reportError],
  );

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      return () => {
        mounted.current = false;
      };
    }

    const controller = new AbortController();
    const requests = messageRequests.current;
    setLoadingThreads(true);
    setLoadingPresets(true);

    void refreshThreads(controller.signal)
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setLoadingThreads(false);
      });

    void refreshPresets(controller.signal)
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setLoadingPresets(false);
      });

    return () => {
      mounted.current = false;
      controller.abort();
      requests.forEach((request) => request.abort());
      requests.clear();
    };
  }, [enabled, refreshPresets, refreshThreads]);

  const requestMessages = useCallback(
    async (threadId: string) => {
      messageRequests.current.get(threadId)?.abort();
      const controller = new AbortController();
      messageRequests.current.set(threadId, controller);
      setLoadingMessages((previous) => ({ ...previous, [threadId]: true }));

      try {
        const messages: Message[] = [];
        let cursor: string | null = null;
        const seenCursors = new Set<string>();

        do {
          const page = await api.listMessages(
            threadId,
            cursor ?? undefined,
            controller.signal,
          );

          messages.push(...page.messages);
          cursor = page.nextCursor;
          if (cursor && seenCursors.has(cursor)) {
            throw new Error("Message pagination repeated a cursor");
          }
          if (cursor) seenCursors.add(cursor);
        } while (cursor);

        if (
          mounted.current &&
          messageRequests.current.get(threadId) === controller
        ) {
          cacheMessages(threadId, messages);
        }

        return messages;
      } catch (failure) {
        if (!(failure instanceof Error && failure.name === "AbortError")) {
          reportError(failure, "Could not load messages.");
        }
        throw failure;
      } finally {
        if (messageRequests.current.get(threadId) === controller) {
          messageRequests.current.delete(threadId);
          if (mounted.current) {
            setLoadingMessages((previous) => ({
              ...previous,
              [threadId]: false,
            }));
          }
        }
      }
    },
    [cacheMessages, reportError],
  );

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (messagesRef.current[threadId] !== undefined) {
        return messagesRef.current[threadId];
      }

      return requestMessages(threadId);
    },
    [requestMessages],
  );

  const refreshMessages = useCallback(
    (threadId: string) => requestMessages(threadId),
    [requestMessages],
  );

  const createThread = useCallback(async () => {
    try {
      const thread = await api.createThread();
      if (mounted.current) setThreads((previous) => [thread, ...previous]);

      return thread;
    } catch (failure) {
      reportError(failure, "Could not create the conversation.");
      throw failure;
    }
  }, [reportError]);

  const renameThread = useCallback(
    async (id: string, title: string) => {
      try {
        const thread = await api.renameThread(id, title);
        if (mounted.current) {
          setThreads((previous) =>
            previous.map((item) => (item.threadId === id ? thread : item)),
          );
        }
      } catch (failure) {
        reportError(failure, "Could not rename the conversation.");
        throw failure;
      }
    },
    [reportError],
  );

  const deleteThread = useCallback(
    async (id: string) => {
      try {
        await api.deleteThread(id);
        if (!mounted.current) return;

        setThreads((previous) =>
          previous.filter((thread) => thread.threadId !== id),
        );

        setMessagesByThread((previous) => {
          const next = { ...previous };
          delete next[id];
          messagesRef.current = next;

          return next;
        });
      } catch (failure) {
        reportError(failure, "Could not delete the conversation.");
        throw failure;
      }
    },
    [reportError],
  );

  const editMessage = useCallback(
    async (threadId: string, messageId: string, content: string) => {
      try {
        await api.editMessage(threadId, messageId, content);
        await requestMessages(threadId);
      } catch (failure) {
        reportError(failure, "Could not edit the message.");
        throw failure;
      }
    },
    [reportError, requestMessages],
  );

  const deleteMessage = useCallback(
    async (threadId: string, messageId: string) => {
      try {
        await api.deleteMessage(threadId, messageId);
        await requestMessages(threadId);
      } catch (failure) {
        reportError(failure, "Could not delete the message.");
        throw failure;
      }
    },
    [reportError, requestMessages],
  );

  const createPreset = useCallback(
    async (title: string, text: string) => {
      try {
        const preset = await api.createPreset(title, text);
        if (mounted.current) setPresets((previous) => [preset, ...previous]);

        return preset;
      } catch (failure) {
        reportError(failure, "Could not create the prompt preset.");
        throw failure;
      }
    },
    [reportError],
  );

  const updatePreset = useCallback(
    async (id: string, patch: Partial<Pick<Preset, "title" | "text">>) => {
      try {
        const preset = await api.updatePreset(id, patch);
        if (mounted.current) {
          setPresets((previous) =>
            previous.map((item) => (item.presetId === id ? preset : item)),
          );
        }
      } catch (failure) {
        reportError(failure, "Could not update the prompt preset.");
        throw failure;
      }
    },
    [reportError],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      try {
        await api.deletePreset(id);
        if (mounted.current) {
          setPresets((previous) =>
            previous.filter((preset) => preset.presetId !== id),
          );
        }
      } catch (failure) {
        reportError(failure, "Could not delete the prompt preset.");
        throw failure;
      }
    },
    [reportError],
  );

  return {
    threads,
    presets,
    messagesByThread,
    loadingThreads,
    loadingPresets,
    loadingMessages,
    error,
    clearError: () => setError(null),
    reportError,
    refreshThreads,
    refreshPresets,
    loadMessages,
    refreshMessages,
    createThread,
    renameThread,
    deleteThread,
    editMessage,
    deleteMessage,
    createPreset,
    updatePreset,
    deletePreset,
  };
}
