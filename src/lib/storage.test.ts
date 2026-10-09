import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import {
  getStore,
  load,
  save,
  setStorageUser,
  updateStore,
  useStore,
} from "./storage";
import type { Store } from "./storage";

describe("storage.ts", () => {
  const mockStore: Store = {
    threads: [
      {
        id: "1",
        title: "Thread 1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    messages: [
      {
        id: "1",
        threadId: "1",
        role: "user",
        content: "Hello",
        createdAt: Date.now(),
      },
    ],
    presets: [
      {
        id: "1",
        title: "Preset 1",
        text: "Preset content",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
  });

  test("load() should return empty store when localStorage is empty", () => {
    const result = load();
    expect(result).toEqual({ threads: [], messages: [], presets: [] });
  });

  test("load() should return parsed store from localStorage", () => {
    localStorage.setItem("promptgpt:test-user:v1", JSON.stringify(mockStore));
    const result = load();
    expect(result).toEqual(mockStore);
  });

  test("save() should store the provided store in localStorage", () => {
    save(mockStore);
    const stored = JSON.parse(
      localStorage.getItem("promptgpt:test-user:v1") || "",
    );
    expect(stored).toEqual(mockStore);
  });
});

test("isolates accounts and restores each user's global presets", () => {
  localStorage.clear();
  const alice = {
    threads: [{ id: "t1", title: "Alice", createdAt: 0, updatedAt: 0 }],
    messages: [],
    presets: [
      {
        id: "p1",
        title: "Alice preset",
        text: "For any Alice thread",
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  };
  setStorageUser("alice");
  save(alice);
  setStorageUser("bob");
  expect(getStore()).toEqual({ threads: [], messages: [], presets: [] });
  save({
    threads: [],
    messages: [],
    presets: [{ ...alice.presets[0], title: "Bob preset" }],
  });
  setStorageUser("alice");
  expect(getStore()).toEqual(alice);
  setStorageUser("bob");
  expect(getStore().presets[0].title).toBe("Bob preset");
});

test("logout hides data, blocks writes, and does not claim legacy data", () => {
  localStorage.clear();
  localStorage.setItem("promptgpt:v1", "legacy data");
  setStorageUser("alice");
  const data = {
    threads: [],
    messages: [],
    presets: [
      { id: "p1", title: "Saved", text: "Prompt", createdAt: 0, updatedAt: 0 },
    ],
  };
  save(data);
  setStorageUser(null);
  save(data);
  updateStore(() => data);
  expect(getStore()).toEqual({ threads: [], messages: [], presets: [] });
  expect(localStorage.getItem("promptgpt:v1")).toBe("legacy data");
  expect(localStorage.length).toBe(2);
  setStorageUser("alice");
  expect(getStore()).toEqual(data);
});

test("ignores an update callback captured before switching accounts", () => {
  setStorageUser("alice");
  const { result } = renderHook(() => useStore());
  const aliceUpdate = result.current[1];
  act(() => setStorageUser("bob"));
  act(() =>
    aliceUpdate((store) => ({
      ...store,
      presets: [
        {
          id: "p1",
          title: "Alice",
          text: "Private",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })),
  );
  expect(getStore().presets).toEqual([]);
  expect(localStorage.getItem("promptgpt:bob:v1")).toBeNull();
});
