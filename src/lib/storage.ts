/*
    lib/storage.ts — localStorage helpers (versioned)
*/

import { useSyncExternalStore } from "react";
import type { Thread, Message, Preset } from "../types";

// Temporary solutions before DB:
// Per-user storage, not anonymous: also the old promptgpt:v1 key is kept.
let storageUser: string | null = null;
const storageKey = () => (storageUser ? `promptgpt:${storageUser}:v1` : null);
export interface Store {
  threads: Thread[];
  messages: Message[];
  presets: Preset[];
}

const empty: Store = { threads: [], messages: [], presets: [] };

export function load(): Store {
  try {
    const key = storageKey();
    return key ? JSON.parse(localStorage.getItem(key) || "") || empty : empty;
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
  const key = storageKey();
  const raw = key ? localStorage.getItem(key) : null;
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
  const key = storageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(store));
  cachedRaw = localStorage.getItem(key);
  cachedStore = store;
  listeners.forEach((listener) => listener());
}

export function setStorageUser(userId: string | null) {
  if (storageUser === userId) return;
  storageUser = userId;
  cachedRaw = undefined;
  cachedStore = load();
  listeners.forEach((listener) => listener());
}

export function useStorageUser() {
  return useSyncExternalStore(subscribeStore, () => storageUser);
}

export function updateStore(update: (store: Store) => Store): Store {
  // Apply changes to the latest snapshot so stale component state cannot restore deleted data.
  const previous = getStore();
  if (!storageUser) return previous;
  const next = update(previous);
  if (next !== previous) save(next);
  return next;
}

export function useStore() {
  const userId = useStorageUser();
  const store = useSyncExternalStore(subscribeStore, getStore);
  // Ignore callbacks captured by a workspace belonging to a previous account.
  const update = (change: (store: Store) => Store) =>
    userId === storageUser ? updateStore(change) : getStore();
  return [store, update] as const;
}
