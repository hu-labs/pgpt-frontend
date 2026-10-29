import { beforeEach, expect, test, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

const session = {
  tokens: { idToken: { toString: () => "id-token" } },
} as Awaited<ReturnType<typeof fetchAuthSession>>;

async function client() {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "https://example.com/test/chat");
  vi.stubEnv("VITE_API_KEY", "preview-key");

  return import("./api");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAuthSession).mockResolvedValue(session);
});

test("derives sibling API paths and supplies authentication headers", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ threads: [] }), { status: 200 }),
    );

  vi.stubGlobal("fetch", fetchMock);
  const api = await client();

  await api.listThreads();
  expect(fetchMock).toHaveBeenCalledWith(
    "https://example.com/test/threads",
    expect.objectContaining({ signal: undefined }),
  );

  const headers = fetchMock.mock.calls[0][1].headers as Headers;
  expect(headers.get("Authorization")).toBe("Bearer id-token");
  expect(headers.get("X-Api-Key")).toBe("preview-key");
});

test("encodes message pagination and JSON mutation bodies", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [], nextCursor: null })),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          presetId: "preset",
          title: "Title",
          text: "Text",
          createdAt: "now",
          updatedAt: "now",
        }),
      ),
    );

  vi.stubGlobal("fetch", fetchMock);
  const api = await client();

  await api.listMessages("thread/id", "cursor/value");
  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://example.com/test/threads/thread%2Fid/messages?cursor=cursor%2Fvalue",
  );

  await api.createPreset("Title", "Text");
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({ title: "Title", text: "Text" }),
  });

  expect(
    (fetchMock.mock.calls[1][1].headers as Headers).get("Content-Type"),
  ).toBe("application/json");
});

test("handles empty 204 responses and rejects non-success statuses", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));

  vi.stubGlobal("fetch", fetchMock);
  const api = await client();

  await expect(api.deleteThread("thread")).resolves.toBeUndefined();
  await expect(api.listThreads()).rejects.toThrow("API request failed (503)");
});

test("sends only the thread ID and new content to the streaming endpoint", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetchMock);
  const api = await client();
  const controller = new AbortController();

  await api.sendChat("thread", "Hello", controller.signal);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://example.com/test/chat",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ threadId: "thread", content: "Hello" }),
      signal: controller.signal,
    }),
  );
});

test("rejects requests when Cognito has no ID token", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue(
    {} as Awaited<ReturnType<typeof fetchAuthSession>>,
  );

  vi.stubGlobal("fetch", vi.fn());
  const api = await client();

  await expect(api.listThreads()).rejects.toThrow("Not authenticated");
  expect(fetch).not.toHaveBeenCalled();
});
