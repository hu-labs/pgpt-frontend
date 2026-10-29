import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useCopyToClipboard } from "./useCopyToClipboard";

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

beforeEach(() => {
  mockClipboard(vi.fn().mockResolvedValue(undefined));
});

describe("useCopyToClipboard", () => {
  test("writes to the clipboard and flags copied, then resets after the delay", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard(1000));

    await act(async () => {
      await result.current.copy("hello");
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.copied).toBe(false);

    vi.useRealTimers();
  });

  test("leaves copied false when the clipboard write fails", async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });

    expect(result.current.copied).toBe(false);
  });
});
