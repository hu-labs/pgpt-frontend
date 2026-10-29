import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { sendChat } from "../lib/api";
import type { Message } from "../types";
import ChatPane from "./ChatPane";

vi.mock("../lib/api", () => ({ sendChat: vi.fn() }));

const threadId = "550e8400-e29b-41d4-a716-446655440000";
const storedMessages: Message[] = [
  {
    messageId: `1792846800000-${threadId}`,
    threadId,
    role: "user",
    content: "Stored question",
    createdAt: "2026-10-28T10:00:00.000Z",
  },
  {
    messageId: `1792846800001-${threadId}`,
    threadId,
    role: "assistant",
    content: "Stored answer",
    createdAt: "2026-10-28T10:00:01.000Z",
  },
];

function props(overrides: Partial<React.ComponentProps<typeof ChatPane>> = {}) {
  return {
    threadId,
    threadIds: [threadId],
    messages: storedMessages,
    presetTrigger: 0,
    onRefreshMessages: vi.fn().mockResolvedValue(storedMessages),
    onRefreshThreads: vi.fn().mockResolvedValue([]),
    onEditMessage: vi.fn().mockResolvedValue(undefined),
    onDeleteMessage: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(),
    onActiveChange: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

test("streams optimistic display and replaces it with authoritative messages on done", async () => {
  const user = userEvent.setup();
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });

  vi.mocked(sendChat).mockResolvedValue(new Response(body));
  const options = props();
  render(<ChatPane {...options} />);

  await user.type(
    screen.getByPlaceholderText("Type a message..."),
    "New prompt",
  );

  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByText("New prompt")).toBeInTheDocument();
  expect(
    screen.getAllByRole("button", { name: "Edit message" })[0],
  ).toBeDisabled();

  expect(
    screen.getAllByRole("button", { name: "Delete message" })[0],
  ).toBeDisabled();

  expect(sendChat).toHaveBeenCalledWith(
    threadId,
    "New prompt",
    expect.any(AbortSignal),
  );

  expect(options.onActiveChange).toHaveBeenCalledWith(threadId, true);

  const encoder = new TextEncoder();
  await act(async () => {
    streamController.enqueue(
      encoder.encode('event: delta\ndata: {"content":"Streaming answer"}\n\n'),
    );
  });

  expect(await screen.findByText("Streaming answer")).toBeInTheDocument();

  await act(async () => {
    streamController.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
    streamController.close();
  });

  await waitFor(() =>
    expect(options.onRefreshMessages).toHaveBeenCalledWith(threadId),
  );

  expect(options.onRefreshThreads).toHaveBeenCalledOnce();
  expect(options.onActiveChange).toHaveBeenLastCalledWith(threadId, false);
  expect(screen.queryByText("New prompt")).not.toBeInTheDocument();
});

test("reports an interrupted stream transiently and never turns partial text into history", async () => {
  const user = userEvent.setup();
  vi.mocked(sendChat).mockResolvedValue(
    new Response(
      'event: delta\ndata: {"content":"Partial"}\n\nevent: error\ndata: {"message":"Provider failed"}\n\n',
    ),
  );

  const options = props({ messages: [] });
  render(<ChatPane {...options} />);

  await user.type(screen.getByPlaceholderText("Type a message..."), "Question");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Response interrupted. Provider failed",
  );

  expect(screen.queryByText("Partial")).not.toBeInTheDocument();
  expect(options.onRefreshMessages).toHaveBeenCalledWith(threadId);
  expect(options.onRefreshThreads).toHaveBeenCalled();
});

test("offers manual refresh after interruption", async () => {
  const user = userEvent.setup();
  vi.mocked(sendChat).mockRejectedValue(new Error("Network unavailable"));
  const options = props({ messages: [] });
  render(<ChatPane {...options} />);

  await user.type(screen.getByPlaceholderText("Type a message..."), "Question");
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByRole("alert");
  vi.mocked(options.onRefreshMessages).mockClear();
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  expect(options.onRefreshMessages).toHaveBeenCalledWith(threadId);
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
});

test("edits and deletes messages without implying regeneration", async () => {
  const user = userEvent.setup();
  const options = props();
  render(<ChatPane {...options} />);

  expect(
    screen.getAllByText("Edits and deletions do not regenerate later replies."),
  ).toHaveLength(1);

  expect(screen.getAllByRole("button", { name: "Edit message" })).toHaveLength(
    1,
  );

  expect(
    screen.getAllByRole("button", { name: "Delete message" }),
  ).toHaveLength(1);

  expect(screen.getByRole("button", { name: "Copy message" })).toBeVisible();

  const userBubble = screen
    .getByText("Stored question")
    .closest('[data-message-bubble="user"]');

  const editButton = screen.getByRole("button", { name: "Edit message" });
  const deleteButton = screen.getByRole("button", { name: "Delete message" });
  expect(userBubble).not.toContainElement(editButton);
  expect(userBubble).not.toContainElement(deleteButton);
  expect(deleteButton).toHaveTextContent("×");

  await user.click(editButton);
  const editor = screen.getByRole("textbox", { name: "Edit message content" });
  await user.clear(editor);
  await user.type(editor, "Edited question");
  await user.click(screen.getByRole("button", { name: "Save edited message" }));
  expect(options.onEditMessage).toHaveBeenCalledWith(
    threadId,
    storedMessages[0].messageId,
    "Edited question",
  );

  await user.click(deleteButton);

  expect(options.onDeleteMessage).toHaveBeenCalledWith(
    threadId,
    storedMessages[0].messageId,
  );
});

test("keeps per-thread drafts while switching selection", async () => {
  const user = userEvent.setup();
  const second = "6d9c7c45-6cb3-4ced-b0cd-66ea532f32f2";
  const options = props({ threadIds: [threadId, second] });
  const { rerender } = render(<ChatPane {...options} />);
  await user.type(
    screen.getByPlaceholderText("Type a message..."),
    "First draft",
  );

  rerender(<ChatPane {...options} threadId={second} messages={[]} />);
  expect(screen.getByPlaceholderText("Type a message...")).toHaveValue("");
  await user.type(
    screen.getByPlaceholderText("Type a message..."),
    "Second draft",
  );

  rerender(<ChatPane {...options} />);
  expect(screen.getByPlaceholderText("Type a message...")).toHaveValue(
    "First draft",
  );
});
