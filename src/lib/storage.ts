/*
    lib/storage.ts — localStorage helpers (versioned)
*/

import { useSyncExternalStore } from "react";
import type { Thread, Message, Preset } from "../types";

const KEY = "promptgpt:v1";
export interface Store {
  threads: Thread[];
  messages: Message[];
  presets: Preset[];
}

const empty: Store = { threads: [], messages: [], presets: [] };

export function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "") || empty;
  } catch {
    return empty;
  }
}
// Share one store across chat, threads, and global presets.
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedStore: Store = empty;

// React needs a stable snapshot reference until the stored data changes.
export function getStore(): Store {
  const raw = localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStore = load();
  }
  return cachedStore;
}

export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
  cachedRaw = localStorage.getItem(KEY);
  cachedStore = store;
  listeners.forEach((listener) => listener());
}

export function updateStore(update: (store: Store) => Store): Store {
  // Apply changes to the latest snapshot so stale component state cannot restore deleted data.
  const previous = getStore();
  const next = update(previous);
  if (next !== previous) save(next);
  return next;
}

export function useStore() {
  return [useSyncExternalStore(subscribeStore, getStore), updateStore] as const;
}
