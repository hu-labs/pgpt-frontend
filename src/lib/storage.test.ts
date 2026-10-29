import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import {
  getStorageUser,
  setStorageUser,
  subscribeStorageUser,
  useStorageUser,
} from "./storage";

beforeEach(() => setStorageUser(null));

test("publishes authenticated account changes through a stable hook", () => {
  const { result } = renderHook(() => useStorageUser());
  expect(result.current).toBeNull();

  act(() => setStorageUser("alice"));
  expect(result.current).toBe("alice");
  expect(getStorageUser()).toBe("alice");

  act(() => setStorageUser(null));
  expect(result.current).toBeNull();
});

test("does not notify subscribers when the account is unchanged", () => {
  const listener = vi.fn();
  const unsubscribe = subscribeStorageUser(listener);

  setStorageUser("alice");
  setStorageUser("alice");
  expect(listener).toHaveBeenCalledOnce();

  unsubscribe();
  setStorageUser("bob");
  expect(listener).toHaveBeenCalledOnce();
});

test("does not read or write browser persistence", () => {
  const getItem = vi.spyOn(Storage.prototype, "getItem");
  const setItem = vi.spyOn(Storage.prototype, "setItem");

  setStorageUser("alice");
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});
