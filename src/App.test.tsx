import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { setStorageUser } from "./lib/storage";
import type { Message, Preset, Thread } from "./types";

const api = vi.hoisted(() => ({
  listThreads: vi.fn(),
  createThread: vi.fn(),
  renameThread: vi.fn(),
  deleteThread: vi.fn(),
  listMessages: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  listPresets: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
  sendChat: vi.fn(),
}));

vi.mock("./lib/api", () => api);
vi.mock("./components/AuthButton", () => ({
  default: () => <button type="button">Auth</button>,
}));

const threads: Thread[] = ["First", "Second"].map((title, index) => ({
  threadId: `550e8400-e29b-41d4-a716-44665544000${index}`,
  title,
  createdAt: `2026-10-28T10:00:0${index}.000Z`,
  updatedAt: `2026-10-28T10:00:0${index}.000Z`,
}));

const messages: Message[] = [
  {
    messageId: `1792846800000-${threads[0].threadId}`,
    threadId: threads[0].threadId,
    role: "user",
    content: "Old message",
    createdAt: "2026-10-28T10:00:00.000Z",
  },
];

const presets: Preset[] = [
  {
    presetId: "6d9c7c45-6cb3-4ced-b0cd-66ea532f32f2",
    title: "Global preset",
    text: "Reusable prompt",
    createdAt: "2026-10-28T10:00:00.000Z",
    updatedAt: "2026-10-28T10:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  setStorageUser("alice");
  api.listThreads.mockResolvedValue({ threads });
  api.listPresets.mockResolvedValue({ presets });
  api.listMessages.mockResolvedValue({ messages, nextCursor: null });
  api.deleteThread.mockResolvedValue(undefined);
});

describe("responsive navigation", () => {
  test("opens and closes the mobile drawer disclosure", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getAllByRole("button", { name: "Close menu" })[0]);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("collapses, restores, and keyboard-resizes the desktop sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const shell = container.firstElementChild as HTMLElement;

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(shell.className).toContain("shellSidebarCollapsed");
    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(shell.className).not.toContain("shellSidebarCollapsed");

    const separator = screen.getByRole("separator", { name: "Resize sidebar" });
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "316");
  });
});

test("loads threads and presets, then fetches each conversation only once", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(
    await screen.findByLabelText("Thread title: First"),
  ).toBeInTheDocument();

  expect(
    screen.getByLabelText("Preset title: Global preset"),
  ).toBeInTheDocument();

  await user.click(screen.getByLabelText("Thread title: First"));
  expect(await screen.findByText("Old message")).toBeInTheDocument();
  await user.click(screen.getByLabelText("Thread title: Second"));
  await user.click(screen.getByLabelText("Thread title: First"));

  expect(
    api.listMessages.mock.calls.filter(([id]) => id === threads[0].threadId),
  ).toHaveLength(1);
});

test("successful deletion unloads the selected conversation and preserves presets", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByLabelText("Thread title: First"));
  await screen.findByText("Old message");
  await user.click(screen.getByRole("button", { name: "Actions for First" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));

  expect(api.deleteThread).toHaveBeenCalledWith(threads[0].threadId);
  expect(
    await screen.findByText("Select or create a thread"),
  ).toBeInTheDocument();

  expect(
    screen.getByLabelText("Preset title: Global preset"),
  ).toBeInTheDocument();
});

test("failed deletion leaves the thread visible and reports the error", async () => {
  api.deleteThread.mockRejectedValue(new Error("Database unavailable"));
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Actions for First" }),
  );

  await user.click(screen.getByRole("button", { name: "Delete" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not delete the conversation",
  );

  expect(screen.getByLabelText("Thread title: First")).toBeInTheDocument();
});

test("account switching discards old cached data and ignores a late response", async () => {
  let resolveAlice!: (value: { threads: Thread[] }) => void;
  api.listThreads
    .mockReturnValueOnce(
      new Promise<{ threads: Thread[] }>((resolve) => {
        resolveAlice = resolve;
      }),
    )
    .mockResolvedValueOnce({
      threads: [{ ...threads[0], title: "Bob thread" }],
    });

  const { rerender } = render(<App />);

  await act(async () => setStorageUser("bob"));
  rerender(<App />);
  expect(
    await screen.findByLabelText("Thread title: Bob thread"),
  ).toBeInTheDocument();

  await act(async () => resolveAlice({ threads }));
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Thread title: First"),
    ).not.toBeInTheDocument(),
  );
});
