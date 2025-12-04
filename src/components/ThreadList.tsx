/*
        Thread CRUD
*/

import { useState, useRef } from "react";
import { load, save } from "../lib/storage";
import type { Thread } from "../types";

export default function ThreadList({ onSelect, isMenuOpen }: { onSelect: (id:string)=>void, isMenuOpen: boolean }) {
  const [store, setStore] = useState(load());
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function createThread() {
    const t: Thread = { id: crypto.randomUUID(), title: "New chat", createdAt: Date.now(), updatedAt: Date.now() };
    const next = { ...store, threads: [t, ...store.threads] };
    setStore(next); save(next); onSelect(t.id);

    // Focus the input field for the new thread
    setTimeout(() => {
      inputRefs.current[t.id]?.focus();
    }, 0);
  }
  function renameThread(id: string, title: string) {
    setStore(prev => {
        const next = { ...prev, threads: prev.threads.map(t => t.id === id ? { ...t, title, updatedAt: Date.now() } : t) };
        save(next);
        return next;
    });
  }
  function deleteThread(id: string) {
    const nextThreads = store.threads.filter(t => t.id !== id);
    const nextMessages = store.messages.filter(m => m.threadId !== id);
    const next = { ...store, threads: nextThreads, messages: nextMessages };
    setStore(next); save(next);
  }

  return (
    <div>
      <button onClick={createThread} className="major-button"
              style={{ display: 'block', margin: '2px auto 14px' }}
              tabIndex={isMenuOpen ? 0 : -1}
      >
        New thread
      </button>
      <ul className="thread-list">
        {store.threads.map(t => (
        <li key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <input className="threadInput"
            defaultValue={t.title}
            onBlur={e => renameThread(t.id, (e.target as HTMLInputElement).value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            ref={(el) => {
              inputRefs.current[t.id] = el;
            }}
            tabIndex={isMenuOpen ? 0 : -1}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', marginBottom: '4px' }}>
            <button onClick={() => onSelect(t.id)} className="minor-button"
              tabIndex={isMenuOpen ? 0 : -1} >
              Open
            </button>
            <button onClick={() => deleteThread(t.id)} className="minor-button"
              tabIndex={isMenuOpen ? 0 : -1} >
              Delete
            </button>
          </div>
        </li>
        ))}
      </ul>
    </div>
  );
}
