/*
    lib/storage.ts — localStorage helpers (versioned)
*/

import type { Thread, Message, Preset } from "../types";

const KEY = "promptgpt:v1";
export interface Store {
  threads: Thread[];
  messages: Message[];
  presets: Preset[];
}

const empty: Store = { threads: [], messages: [], presets: [] };

export function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || "") || empty; }
  catch { return empty; }
}
export function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}
