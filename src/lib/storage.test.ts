/// <reference types="jest" />
import { load, save } from "./storage";
import type { Store } from "./storage";

describe("storage.ts", () => {
  const mockStore: Store = {
    threads: [{ id: "1", title: "Thread 1", createdAt: Date.now(), updatedAt: Date.now() }],
    messages: [{ id: "1", threadId: "1", role: "user", content: "Hello", createdAt: Date.now() }],
    presets: [{ id: "1", title: "Preset 1", text: "Preset content", createdAt: Date.now(), updatedAt: Date.now() }],
  };

  beforeEach(() => {
    localStorage.clear();
  });

  test("load() should return empty store when localStorage is empty", () => {
    const result = load();
    expect(result).toEqual({ threads: [], messages: [], presets: [] });
  });

  test("load() should return parsed store from localStorage", () => {
    localStorage.setItem("promptgpt:v1", JSON.stringify(mockStore));
    const result = load();
    expect(result).toEqual(mockStore);
  });

  test("save() should store the provided store in localStorage", () => {
    save(mockStore);
    const stored = JSON.parse(localStorage.getItem("promptgpt:v1") || "");
    expect(stored).toEqual(mockStore);
  });
});