/* Renders the server-backed thread list and delegates all mutations to the workspace cache. */

import { useRef, useState } from "react";
import { useClickOutside } from "../lib/useClickOutside";
import type { Thread } from "../types";
import controls from "./Controls.module.css";
import styles from "./SidebarList.module.css";

interface ThreadListProps {
  threads: Thread[];
  onSelect: (id: string) => void;
  onCreate: () => Promise<Thread>;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeThreadIds: ReadonlySet<string>;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function ThreadList({
  threads,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  activeThreadIds,
  isLoading = false,
  disabled = false,
}: ThreadListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpenMenuId(null));

  function enterEditMode(thread: Thread) {
    setEditingThreadId(thread.threadId);
    setEditingTitle(thread.title);
    setOpenMenuId(null);
    setTimeout(() => {
      const input = inputRefs.current[thread.threadId];
      input?.focus();
      input?.select();
    }, 0);
  }

  async function handleCreate() {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const thread = await onCreate();
      onSelect(thread.threadId);
      enterEditMode(thread);
    } catch {
      // The workspace error banner reports the server failure.
    } finally {
      setIsCreating(false);
    }
  }

  async function saveRename(thread: Thread) {
    const title = editingTitle.trim();
    if (!title || title === thread.title) {
      if (title === thread.title) setEditingThreadId(null);

      return;
    }

    setBusyId(thread.threadId);
    try {
      await onRename(thread.threadId, title);
      setEditingThreadId(null);
    } catch {
      // Keep the editor open so the user can retry.
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (activeThreadIds.has(id)) return;
    setBusyId(id);

    try {
      await onDelete(id);
      setOpenMenuId(null);
    } catch {
      // Keep the server-owned thread visible and the actions available.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="threads-heading">
      <h2 id="threads-heading" className={controls.visuallyHidden}>
        Threads
      </h2>
      <button
        type="button"
        onClick={() => void handleCreate()}
        disabled={disabled || isCreating}
        className={`${controls.button} ${controls.primary} ${styles.centeredAction}`}
      >
        {isCreating ? "Creating…" : "New thread"}
      </button>
      {isLoading && <p className={styles.status}>Loading conversations…</p>}
      <ul className={styles.list}>
        {threads.map((thread) => {
          const id = thread.threadId;
          const isEditing = editingThreadId === id;
          const isActive = activeThreadIds.has(id);

          return (
            <li className={styles.item} key={id}>
              <input
                className={`${controls.field} ${styles.itemInput}${
                  isEditing ? ` ${styles.itemInputEditing}` : ""
                }`}
                value={isEditing ? editingTitle : thread.title}
                readOnly={!isEditing}
                disabled={busyId === id}
                aria-label={`Thread title: ${thread.title}`}
                onChange={(event) => setEditingTitle(event.target.value)}
                onClick={() => {
                  if (!isEditing) onSelect(id);
                }}
                onBlur={() => {
                  if (isEditing) void saveRename(thread);
                }}
                onMouseDown={(event) => {
                  if (!isEditing) event.preventDefault();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isEditing) {
                    event.preventDefault();
                    void saveRename(thread);
                  } else if (event.key === "Escape" && isEditing) {
                    event.preventDefault();
                    setEditingThreadId(null);
                    setEditingTitle(thread.title);
                  }
                }}
                ref={(element) => {
                  inputRefs.current[id] = element;
                }}
              />
              <button
                type="button"
                className={`${controls.button} ${controls.icon} ${styles.actionsToggle}`}
                onClick={() => setOpenMenuId(openMenuId === id ? null : id)}
                aria-label={`Actions for ${thread.title}`}
                aria-expanded={openMenuId === id}
                aria-controls={`thread-actions-${id}`}
              >
                <span aria-hidden="true">⋮</span>
              </button>
              {openMenuId === id && (
                <div
                  ref={menuRef}
                  id={`thread-actions-${id}`}
                  className={styles.actionsPanel}
                >
                  <button
                    type="button"
                    onClick={() => enterEditMode(thread)}
                    className={`${controls.button} ${styles.actionButton}`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(id)}
                    disabled={isActive || busyId === id}
                    title={
                      isActive
                        ? "Wait for the active response before deleting this thread."
                        : undefined
                    }
                    className={`${controls.button} ${styles.actionButton}`}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
