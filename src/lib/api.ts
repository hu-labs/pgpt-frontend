/* Central authenticated API client for thread, message, preset, and streaming chat operations. */

import { fetchAuthSession } from "aws-amplify/auth";
import type { Message, Preset, Thread } from "../types";

const CHAT_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const API_BASE = CHAT_URL.replace(/\/chat\/?$/, "");

async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (!CHAT_URL) throw new Error("VITE_API_URL is not configured");

  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();

  if (!token) throw new Error("Not authenticated");

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (import.meta.env.DEV && import.meta.env.VITE_API_KEY) {
    headers.set("X-Api-Key", import.meta.env.VITE_API_KEY);
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const listThreads = (signal?: AbortSignal) =>
  apiJson<{ threads: Thread[] }>("/threads", { signal });

export const createThread = (title?: string) =>
  apiJson<Thread>("/threads", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });

export const renameThread = (id: string, title: string) =>
  apiJson<Thread>(`/threads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const deleteThread = (id: string) =>
  apiJson<void>(`/threads/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const listMessages = (
  id: string,
  cursor?: string,
  signal?: AbortSignal,
) =>
  apiJson<{ messages: Message[]; nextCursor: string | null }>(
    `/threads/${encodeURIComponent(id)}/messages${
      cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
    }`,
    { signal },
  );

export const editMessage = (id: string, messageId: string, content: string) =>
  apiJson<Message>(
    `/threads/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ content }),
    },
  );

export const deleteMessage = (id: string, messageId: string) =>
  apiJson<void>(
    `/threads/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" },
  );

export const listPresets = (signal?: AbortSignal) =>
  apiJson<{ presets: Preset[] }>("/presets", { signal });

export const createPreset = (title: string, text: string) =>
  apiJson<Preset>("/presets", {
    method: "POST",
    body: JSON.stringify({ title, text }),
  });

export const updatePreset = (
  id: string,
  patch: Partial<Pick<Preset, "title" | "text">>,
) =>
  apiJson<Preset>(`/presets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deletePreset = (id: string) =>
  apiJson<void>(`/presets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const sendChat = (
  threadId: string,
  content: string,
  signal: AbortSignal,
) =>
  apiFetch("/chat", {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify({ threadId, content }),
    signal,
  });
