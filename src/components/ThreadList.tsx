/*
        Thread CRUD
*/

import { useState } from "react";
import { load, save } from "../lib/storage";
import type { Thread } from "../types";

export default function ThreadList({ onSelect }: { onSelect: (id:string)=>void }) {
  const [store, setStore] = useState(load());

  function createThread() {
    const t: Thread = { id: crypto.randomUUID(), title: "New chat", createdAt: Date.now(), updatedAt: Date.now() };
    const next = { ...store, threads: [t, ...store.threads] };
    setStore(next); save(next); onSelect(t.id);
  }
  function renameThread(id: string, title: string) {
    const next = { ...store, threads: store.threads.map(t => t.id===id ? { ...t, title, updatedAt: Date.now() } : t) };
    setStore(next); save(next);
  }
  function deleteThread(id: string) {
    const nextThreads = store.threads.filter(t => t.id !== id);
    const nextMessages = store.messages.filter(m => m.threadId !== id);
    const next = { ...store, threads: nextThreads, messages: nextMessages };
    setStore(next); save(next);
  }

  return (
    <div>
      <button onClick={createThread}>New thread</button>
      <ul>
        {store.threads.map(t => (
          <li key={t.id}>
            <input defaultValue={t.title} onBlur={e => renameThread(t.id, e.target.value)} />
            <button onClick={() => onSelect(t.id)}>Open</button>
            <button onClick={() => deleteThread(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
