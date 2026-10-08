import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { load, save } from "../lib/storage";
import type { Message } from "../types";
import ChatPane from "./ChatPane";

function seedMessages(messages: Message[]) {
  save({ threads: [], messages, presets: [] });
}

// A fetch()-body-shaped stream the test can push SSE chunks into on demand,
// to exercise ChatPane's progressive rendering one step at a time.
function createControllableSseBody() {
  const encoder = new TextEncoder();
  type ReadResult = { done: boolean; value?: Uint8Array };
  const queue: ReadResult[] = [];
  let pendingResolve: ((r: ReadResult) => void) | null = null;

  function emit(result: ReadResult) {
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(result);
    } else {
      queue.push(result);
    }
  }

  const reader = {
    read(): Promise<ReadResult> {
      const next = queue.shift();
      if (next) return Promise.resolve(next);
      return new Promise((resolve) => {
        pendingResolve = resolve;
      });
    },
  };
  return {
    body: { getReader: () => reader } as unknown as ReadableStream<Uint8Array>,
    // Pushes are queued even if called back-to-back without awaiting in between.
    push(event: string, data: unknown) {
      const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      emit({ done: false, value: encoder.encode(chunk) });
    },
    close() {
      emit({ done: true });
    },
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ChatPane message rendering", () => {
  test("renders a user message as a plain-text bubble, without parsing markdown", () => {
    seedMessages([
      {
        id: "1",
        threadId: "t1",
        role: "user",
        content: "**bold** text",
        createdAt: Date.now(),
      },
    ]);
    render(<ChatPane threadId="t1" presetTrigger={0} />);

    const bubble = screen.getByText("**bold** text");
    expect(bubble).toHaveAttribute("data-message-role", "user");
  });

  test("renders an assistant message with markdown formatting and no role label", () => {
    seedMessages([
      {
        id: "2",
        threadId: "t1",
        role: "assistant",
        content: "**bold** text",
        createdAt: Date.now(),
      },
    ]);
    render(<ChatPane threadId="t1" presetTrigger={0} />);

    expect(screen.queryByText(/assistant:/i)).not.toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  test("copy action on an assistant message copies the raw markdown content", async () => {
    // userEvent.setup() installs its own clipboard stub, so mock after it runs.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    seedMessages([
      {
        id: "3",
        threadId: "t1",
        role: "assistant",
        content: "hello world",
        createdAt: Date.now(),
      },
    ]);
    render(<ChatPane threadId="t1" presetTrigger={0} />);

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello world");
  });
});

describe("ChatPane streaming replies", () => {
  async function sendMessage(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByPlaceholderText("Type a message..."), "Hi");
    await user.click(screen.getByRole("button", { name: "Send message" }));
  }

  test("shows a typing indicator, then streams tokens in, then commits on done", async () => {
    const user = userEvent.setup();
    const sse = createControllableSseBody();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, body: sse.body } as Response);

    render(<ChatPane threadId="t1" presetTrigger={0} />);
    await sendMessage(user);

    expect(
      await screen.findByLabelText("Assistant is typing"),
    ).toBeInTheDocument();

    sse.push("delta", { content: "Hel" });
    await waitFor(() => expect(screen.getByText("Hel")).toBeInTheDocument());

    sse.push("delta", { content: "lo" });
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());

    sse.push("done", {});
    sse.close();

    // Once committed, the message gets its permanent copy action.
    await screen.findByRole("button", { name: "Copy" });
    expect(
      screen.queryByLabelText("Assistant is typing"),
    ).not.toBeInTheDocument();
    expect(load().messages.find((m) => m.role === "assistant")?.content).toBe(
      "Hello",
    );
  });

  test("appends an error clue when the backend sends an error event", async () => {
    const user = userEvent.setup();
    const sse = createControllableSseBody();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, body: sse.body } as Response);

    render(<ChatPane threadId="t1" presetTrigger={0} />);
    await sendMessage(user);
    await screen.findByLabelText("Assistant is typing");

    sse.push("delta", { content: "Partial" });
    sse.push("error", { message: "Boom" });
    sse.close();

    await waitFor(() =>
      expect(load().messages.find((m) => m.role === "assistant")?.content).toBe(
        "Partial\n\n⚠️ Error: Boom",
      ),
    );
  });

  test("shows an interrupted-connection clue when the stream ends without done/error", async () => {
    const user = userEvent.setup();
    const sse = createControllableSseBody();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, body: sse.body } as Response);

    render(<ChatPane threadId="t1" presetTrigger={0} />);
    await sendMessage(user);
    await screen.findByLabelText("Assistant is typing");

    sse.push("delta", { content: "Partial" });
    sse.close(); // connection drops before a "done"/"error" event arrives

    await waitFor(() =>
      expect(
        load().messages.find((m) => m.role === "assistant")?.content,
      ).toContain("⚠️ Response interrupted"),
    );
  });
});
