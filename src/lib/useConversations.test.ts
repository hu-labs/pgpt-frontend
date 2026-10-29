import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import * as api from "./api";
import { useConversations } from "./useConversations";
import type { Message, Preset, Thread } from "../types";

vi.mock("./api");

const thread: Thread = {
  threadId: "550e8400-e29b-41d4-a716-446655440000",
  title: "Conversation",
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
};

const preset: Preset = {
  presetId: "6d9c7c45-6cb3-4ced-b0cd-66ea532f32f2",
  title: "Concise",
  text: "Be concise.",
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
};

const message = (messageId: string): Message => ({
  messageId,
  threadId: thread.threadId,
  role: "user",
  content: messageId,
  createdAt: "2026-10-28T10:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listThreads).mockResolvedValue({ threads: [thread] });
  vi.mocked(api.listPresets).mockResolvedValue({ presets: [preset] });
});

test("loads account data and retrieves every message page only once", async () => {
  vi.mocked(api.listMessages)
    .mockResolvedValueOnce({ messages: [message("one")], nextCursor: "next" })
    .mockResolvedValueOnce({ messages: [message("two")], nextCursor: null });

  const { result } = renderHook(() => useConversations(true));

  await waitFor(() => expect(result.current.threads).toEqual([thread]));
  expect(result.current.presets).toEqual([preset]);
  await act(async () => {
    await result.current.loadMessages(thread.threadId);
  });

  expect(result.current.messagesByThread[thread.threadId]).toEqual([
    message("one"),
    message("two"),
  ]);

  await act(async () => {
    await result.current.loadMessages(thread.threadId);
  });

  expect(api.listMessages).toHaveBeenCalledTimes(2);
  expect(api.listMessages).toHaveBeenLastCalledWith(
    thread.threadId,
    "next",
    expect.any(AbortSignal),
  );
});

test("refreshes messages after edits and keeps failed deletions cached", async () => {
  vi.mocked(api.listMessages).mockResolvedValue({
    messages: [message("one")],
    nextCursor: null,
  });

  vi.mocked(api.editMessage).mockResolvedValue(message("one"));
  vi.mocked(api.deleteThread).mockRejectedValue(new Error("Database down"));
  const { result } = renderHook(() => useConversations(true));
  await waitFor(() => expect(result.current.threads).toEqual([thread]));

  await act(async () => {
    await result.current.editMessage(thread.threadId, "one", "Edited");
  });

  expect(api.editMessage).toHaveBeenCalledWith(
    thread.threadId,
    "one",
    "Edited",
  );

  expect(api.listMessages).toHaveBeenCalled();

  await act(async () => {
    await expect(result.current.deleteThread(thread.threadId)).rejects.toThrow(
      "Database down",
    );
  });

  expect(result.current.threads).toEqual([thread]);
  expect(result.current.error).toContain("Could not delete the conversation");
});

test("stops malformed pagination that repeats a cursor", async () => {
  vi.mocked(api.listMessages).mockResolvedValue({
    messages: [message("one")],
    nextCursor: "repeat",
  });

  const { result } = renderHook(() => useConversations(true));
  await waitFor(() => expect(result.current.threads).toEqual([thread]));

  await act(async () => {
    await expect(result.current.loadMessages(thread.threadId)).rejects.toThrow(
      "repeated a cursor",
    );
  });

  expect(api.listMessages).toHaveBeenCalledTimes(2);
  expect(result.current.error).toContain("Could not load messages");
});

test("does not call account APIs while logged out", () => {
  renderHook(() => useConversations(false));
  expect(api.listThreads).not.toHaveBeenCalled();
  expect(api.listPresets).not.toHaveBeenCalled();
});
