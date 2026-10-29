/* Tracks the authenticated account so a keyed workspace can discard all in-memory data on account changes. */

import { useSyncExternalStore } from "react";

let storageUser: string | null = null;
const listeners = new Set<() => void>();

export function subscribeStorageUser(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getStorageUser() {
  return storageUser;
}

export function setStorageUser(userId: string | null) {
  if (storageUser === userId) return;

  storageUser = userId;
  listeners.forEach((listener) => listener());
}

export function useStorageUser() {
  return useSyncExternalStore(subscribeStorageUser, getStorageUser);
}
