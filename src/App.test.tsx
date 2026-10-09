import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { load, save, setStorageUser } from "./lib/storage";

// Request tests use a deterministic session instead of real Cognito credentials.
vi.mock("aws-amplify/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("aws-amplify/auth")>();
  return {
    ...original,
    fetchAuthSession: vi.fn(),
    getCurrentUser: vi
      .fn()
      .mockResolvedValue({ userId: "test-user", username: "Test user" }),
  };
});

const authenticatedSession = {
  tokens: { idToken: { toString: () => "test-id-token" } },
} as Awaited<ReturnType<typeof fetchAuthSession>>;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getCurrentUser).mockResolvedValue({
    userId: "test-user",
    username: "Test user",
  });
  vi.mocked(fetchAuthSession)
    .mockReset()
    .mockResolvedValue(authenticatedSession);
});

describe("responsive navigation", () => {
  test("opens and closes the mobile drawer disclosure", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    const sidebar = screen.getByRole("complementary", {
      name: "Threads and prompt presets",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(sidebar.className).toContain("sidebarOpen");

    await user.click(screen.getAllByRole("button", { name: "Close menu" })[0]);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps the existing chat-focus close behavior", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "New thread" }));
    await user.click(screen.getByPlaceholderText("Type a message..."));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("collapses and restores the desktop sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const shell = container.firstElementChild as HTMLElement;

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(shell.className).toContain("shellSidebarCollapsed");

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(shell.className).not.toContain("shellSidebarCollapsed");
  });

  test("resizes the desktop sidebar with the keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    const separator = screen.getByRole("separator", {
      name: "Resize sidebar",
    });

    expect(separator).toHaveAttribute("aria-valuenow", "300");
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "316");
    await user.keyboard("{Home}");
    expect(separator).toHaveAttribute("aria-valuenow", "240");
  });
});

afterEach(() => vi.unstubAllGlobals());

function seedThreads() {
  save({
    threads: ["First", "Second"].map((title) => ({
      id: title,
      title,
      createdAt: 0,
      updatedAt: 0,
    })),
    messages: [
      {
        id: "m1",
        threadId: "First",
        role: "user",
        content: "Old message",
        createdAt: 0,
      },
    ],
    presets: [
      {
        id: "p1",
        title: "Global preset",
        text: "Reusable prompt",
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  });
}

async function deleteThread(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(
    screen.getByRole("button", { name: `Actions for ${title}` }),
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));
}

describe("thread deletion", () => {
  test("unloads the selected chat, preserves global presets, and reuses them in a new thread", async () => {
    seedThreads();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Thread title: First"));
    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Unsent draft",
    );
    await deleteThread(user, "First");
    expect(screen.getByText("Select or create a thread")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Type a message..."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send message" }),
    ).not.toBeInTheDocument();
    expect(load().messages).toEqual([]);
    expect(load().threads.map((thread) => thread.id)).toEqual(["Second"]);
    expect(load().presets[0].text).toBe("Reusable prompt");
    await user.type(
      screen.getByPlaceholderText("Prompt title"),
      "Another preset",
    );
    await user.type(
      screen.getByPlaceholderText("Prompt you want to save"),
      "Another prompt",
    );
    await user.click(screen.getByRole("button", { name: "Add preset" }));
    expect(load().threads.map((thread) => thread.id)).toEqual(["Second"]);
    await user.click(screen.getByRole("button", { name: "New thread" }));
    expect(screen.getByPlaceholderText("Type a message...")).toHaveValue("");
    await user.click(screen.getByLabelText("Preset title: Global preset"));
    expect(screen.getByPlaceholderText("Type a message...")).toHaveValue(
      "Reusable prompt",
    );
  });

  test("deleting another thread keeps the selected chat and its draft", async () => {
    seedThreads();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Thread title: First"));
    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Keep draft",
    );
    await deleteThread(user, "Second");
    expect(screen.getByPlaceholderText("Type a message...")).toHaveValue(
      "Keep draft",
    );
    expect(screen.getByText("Old message")).toBeInTheDocument();
  });

  test("aborts a deleted thread request and ignores late responses without cancelling another thread", async () => {
    seedThreads();
    const user = userEvent.setup();
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn<
      (url: unknown, init: RequestInit) => Promise<Response>
    >(() => new Promise<Response>((resolve) => resolvers.push(resolve)));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await user.click(screen.getByLabelText("Thread title: First"));
    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "First question",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await user.click(screen.getByLabelText("Thread title: Second"));
    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Second question",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await user.click(screen.getByLabelText("Thread title: First"));
    await deleteThread(user, "First");
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
    expect(fetchMock.mock.calls[1][1].signal?.aborted).toBe(false);
    expect(screen.getByText("Select or create a thread")).toBeInTheDocument();
    await act(async () => {
      resolvers[0](new Response("Late reply"));
      resolvers[1](
        new Response(
          'event: delta\ndata: {"content":"Second answer"}\n\nevent: done\ndata: {}\n\n',
        ),
      );
    });
    await waitFor(() =>
      expect(
        load().messages.some((message) => message.content === "Second answer"),
      ).toBe(true),
    );
    expect(load().threads.map((thread) => thread.id)).toEqual(["Second"]);
    expect(
      load().messages.every((message) => message.threadId === "Second"),
    ).toBe(true);
    await user.click(screen.getByLabelText("Thread title: Second"));
    expect(screen.getByText("Second answer")).toBeInTheDocument();
  });

  test("deletion during streaming cancels the request and discards late chunks", async () => {
    seedThreads();
    const user = userEvent.setup();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await user.click(screen.getByLabelText("Thread title: First"));
    await user.type(
      screen.getByPlaceholderText("Type a message..."),
      "Question",
    );
    await user.click(screen.getByRole("button", { name: "Send message" }));
    const encoder = new TextEncoder();
    await act(async () => {
      streamController.enqueue(
        encoder.encode('event: delta\ndata: {"content":"Partial reply"}\n\n'),
      );
    });
    expect(screen.getByText("Partial reply")).toBeInTheDocument();
    await deleteThread(user, "First");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: delta\ndata: {"content":"Late reply"}\n\nevent: done\ndata: {}\n\n',
        ),
      );
      streamController.close();
    });
    await waitFor(() => expect(load().messages).toEqual([]));
    expect(load().threads.map((thread) => thread.id)).toEqual(["Second"]);
    expect(screen.getByText("Select or create a thread")).toBeInTheDocument();
  });
});

test("account switching aborts old requests and resets selection and drafts even with reused thread IDs", async () => {
  seedThreads();
  const aliceData = load();
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await user.click(screen.getByLabelText("Thread title: First"));
  await user.type(
    screen.getByPlaceholderText("Type a message..."),
    "Alice question",
  );
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  await user.type(
    screen.getByPlaceholderText("Type a message..."),
    "Alice draft",
  );

  vi.mocked(getCurrentUser).mockResolvedValue({
    userId: "bob",
    username: "Bob",
  });
  await act(async () => {
    setStorageUser("bob");
    save({
      ...aliceData,
      messages: [],
      presets: [],
      threads: [{ ...aliceData.threads[0], title: "Bob thread" }],
    });
  });
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(screen.getByText("Select or create a thread")).toBeInTheDocument();
  expect(screen.queryByText("Old message")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Preset title: Global preset"),
  ).not.toBeInTheDocument();
  await user.click(screen.getByLabelText("Thread title: Bob thread"));
  expect(screen.getByPlaceholderText("Type a message...")).toHaveValue("");
  expect(load().messages).toEqual([]);

  vi.mocked(getCurrentUser).mockRejectedValue(new Error("Signed out"));
  await act(async () => setStorageUser(null));
  expect(screen.getByText("Select or create a thread")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New thread" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add preset" })).toBeDisabled();
  expect(
    screen.queryByLabelText("Thread title: Bob thread"),
  ).not.toBeInTheDocument();
});
