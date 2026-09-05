/*
        Thread CRUD
*/

import { useState, useRef } from "react";
import { load, save } from "../lib/storage";
import { useClickOutside } from "../lib/useClickOutside";
import type { Thread } from "../types";

export default function ThreadList({
  onSelect,
  isMenuOpen,
}: {
  onSelect: (id: string) => void;
  isMenuOpen: boolean;
}) {
  const [store, setStore] = useState(load());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpenMenuId(null));

  function createThread() {
    const t: Thread = {
      id: crypto.randomUUID(),
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = { ...store, threads: [t, ...store.threads] };
    setStore(next);
    save(next);
    onSelect(t.id);

    // Focus the input field for the new thread
    setTimeout(() => {
      inputRefs.current[t.id]?.focus();
    }, 0);
  }

  function renameThread(id: string, title: string) {
    // Set title in store
    setStore((prev) => {
      const next = {
        ...prev,
        threads: prev.threads.map((t) =>
          t.id === id ? { ...t, title, updatedAt: Date.now() } : t,
        ),
      };
      save(next);
      return next;
    });
    setEditingThreadId(null);
  }

  function enterEditMode(id: string) {
    setEditingThreadId(id);
    setOpenMenuId(null);
    setTimeout(() => {
      const input = inputRefs.current[id];
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function deleteThread(id: string) {
    const nextThreads = store.threads.filter((t) => t.id !== id);
    const nextMessages = store.messages.filter((m) => m.threadId !== id);
    const next = { ...store, threads: nextThreads, messages: nextMessages };
    setStore(next);
    save(next);
  }

  return (
    <div>
      <button
        onClick={createThread}
        className="major-button"
        style={{ display: "block", margin: "2px auto 14px" }}
        tabIndex={isMenuOpen ? 0 : -1}
      >
        New thread
      </button>
      <ul className="thread-list">
        {store.threads.map((t) => (
          <li
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              position: "relative",
              marginBottom: "8px",
            }}
          >
            <input
              className="threadInput"
              defaultValue={t.title}
              readOnly={editingThreadId !== t.id}
              onClick={() => {
                if (editingThreadId !== t.id) {
                  onSelect(t.id);
                }
              }}
              onBlur={(e) => {
                if (editingThreadId === t.id) {
                  renameThread(t.id, (e.target as HTMLInputElement).value);
                }
              }}
              onMouseDown={(e) => {
                // Prevent text selection when inactive
                if (editingThreadId !== t.id) {
                  e.preventDefault();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editingThreadId === t.id) {
                  const input = e.currentTarget as HTMLInputElement;
                  input.setSelectionRange(0, 0);
                  input.blur();
                } else if (e.key === "Escape" && editingThreadId === t.id) {
                  const input = e.currentTarget as HTMLInputElement;
                  input.value = t.title;
                  input.setSelectionRange(0, 0);
                  setEditingThreadId(null);
                  input.blur();
                }
              }}
              ref={(e) => {
                inputRefs.current[t.id] = e;
              }}
              style={{
                flex: 1,
                cursor: editingThreadId === t.id ? "text" : "pointer",
              }}
              tabIndex={isMenuOpen ? 0 : -1}
            />
            <button
              onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                padding: 0,
              }}
              tabIndex={isMenuOpen ? 0 : -1}
            >
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: "10px",
                  lineHeight: "4px",
                  transform: "translateY(0px)",
                }}
              >
                <span>•</span>
                <span>•</span>
                <span>•</span>
              </span>
            </button>
            {openMenuId === t.id && (
              <div
                ref={menuRef}
                style={{
                  position: "absolute",
                  right: "-20px",
                  top: "20px",
                  paddingLeft: "5px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "0 2px 8px var(--color-shadow)",
                  zIndex: 1000,
                  minWidth: "20px",
                  maxWidth: "55px",
                }}
              >
                <button
                  onClick={() => {
                    enterEditMode(t.id);
                  }}
                  className="minor-button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderRadius: 0,
                    borderBottom: "0px solid #eee",
                    paddingTop: "0px",
                    paddingBottom: "4px",
                    marginTop: "0px",
                    marginBottom: "0px",
                  }}
                  tabIndex={isMenuOpen ? 0 : -1}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    deleteThread(t.id);
                    setOpenMenuId(null);
                  }}
                  className="minor-button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderRadius: 0,
                    borderTop: "0px solid #ca8e17",
                    paddingTop: "4px",
                    margin: "0px",
                  }}
                  tabIndex={isMenuOpen ? 0 : -1}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
