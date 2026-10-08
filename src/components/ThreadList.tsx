/*
        Thread CRUD
*/

import { useState, useRef } from "react";
import { useStore } from "../lib/storage";
import { useClickOutside } from "../lib/useClickOutside";
import type { Thread } from "../types";
import controls from "./Controls.module.css";
import styles from "./SidebarList.module.css";

export default function ThreadList({
  onSelect,
  onDelete,
}: {
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [store, setStore] = useStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpenMenuId(null));

  // Rename thread helper: focus and select the input for the given thread
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

  function createThread() {
    const t: Thread = {
      id: crypto.randomUUID(),
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setStore((prev) => ({ ...prev, threads: [t, ...prev.threads] }));
    onSelect(t.id);

    // New threads use the same focused, selected title editor as Rename.
    enterEditMode(t.id);
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
      return next;
    });
    setEditingThreadId(null);
  }

  function deleteThread(id: string) {
    // Delete the thread and its messages together; global presets stay untouched.
    setStore((prev) => ({
      ...prev,
      threads: prev.threads.filter((t) => t.id !== id),
      messages: prev.messages.filter((m) => m.threadId !== id),
    }));
    onDelete?.(id);
  }

  return (
    <section className={styles.section} aria-labelledby="threads-heading">
      <h2 id="threads-heading" className={controls.visuallyHidden}>
        Threads
      </h2>
      <button
        type="button"
        onClick={createThread}
        className={`${controls.button} ${controls.primary} ${styles.centeredAction}`}
      >
        New thread
      </button>
      <ul className={styles.list}>
        {store.threads.map((t) => (
          <li className={styles.item} key={t.id}>
            <input
              className={`${controls.field} ${styles.itemInput}${
                editingThreadId === t.id ? ` ${styles.itemInputEditing}` : ""
              }`}
              defaultValue={t.title}
              readOnly={editingThreadId !== t.id}
              aria-label={`Thread title: ${t.title}`}
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
            />
            <button
              type="button"
              className={`${controls.button} ${controls.icon} ${styles.actionsToggle}`}
              onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
              aria-label={`Actions for ${t.title}`}
              aria-expanded={openMenuId === t.id}
              aria-controls={`thread-actions-${t.id}`}
            >
              <span aria-hidden="true">⋮</span>
            </button>
            {openMenuId === t.id && (
              <div
                ref={menuRef}
                id={`thread-actions-${t.id}`}
                className={styles.actionsPanel}
              >
                <button
                  type="button"
                  onClick={() => {
                    enterEditMode(t.id);
                  }}
                  className={`${controls.button} ${styles.actionButton}`}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteThread(t.id);
                    setOpenMenuId(null);
                  }}
                  className={`${controls.button} ${styles.actionButton}`}
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
