/* Renders prompt presets stored in DynamoDB and delegates their CRUD operations to the workspace cache. */

import { useRef, useState } from "react";
import type { Preset } from "../types";
import controls from "./Controls.module.css";
import SidebarItemMenu from "./SidebarItemMenu";
import styles from "./SidebarList.module.css";

interface PresetListProps {
  presets: Preset[];
  onAppend: (text: string) => void;
  onCreate: (title: string, text: string) => Promise<Preset>;
  onUpdate: (
    id: string,
    patch: Partial<Pick<Preset, "title" | "text">>,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function PresetList({
  presets,
  onAppend,
  onCreate,
  onUpdate,
  onDelete,
  isLoading = false,
  disabled = false,
}: PresetListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const actionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );

  async function handleCreate() {
    if (!title.trim() || !text.trim() || isCreating) return;
    setIsCreating(true);

    try {
      await onCreate(title.trim(), text.trim());
      setTitle("");
      setText("");
    } catch {
      // Preserve the form values for retry; the workspace reports the failure.
    } finally {
      setIsCreating(false);
    }
  }

  function enterEditMode(preset: Preset) {
    setEditingPresetId(preset.presetId);
    setEditingTitle(preset.title);
    setOpenMenuId(null);
    setTimeout(() => {
      const input = inputRefs.current[preset.presetId];
      input?.focus();
      input?.select();
    }, 0);
  }

  async function saveTitle(preset: Preset) {
    const nextTitle = editingTitle.trim();
    if (!nextTitle || nextTitle === preset.title) {
      if (nextTitle === preset.title) setEditingPresetId(null);

      return;
    }

    setBusyId(preset.presetId);
    try {
      await onUpdate(preset.presetId, { title: nextTitle });
      setEditingPresetId(null);
    } catch {
      // Keep the editor open so the user can retry.
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await onDelete(id);
      setOpenMenuId(null);
    } catch {
      // Keep the server-owned preset visible and the actions available.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="presets-heading">
      <h2 id="presets-heading" className={styles.heading}>
        Prompt presets
      </h2>

      <div className={styles.createFields}>
        <label className={controls.visuallyHidden} htmlFor="preset-title">
          Prompt title
        </label>
        <input
          id="preset-title"
          className={controls.field}
          placeholder="Prompt title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <label className={controls.visuallyHidden} htmlFor="preset-text">
          Prompt to save
        </label>
        <textarea
          id="preset-text"
          className={controls.field}
          placeholder="Prompt you want to save"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={disabled || isCreating || !title.trim() || !text.trim()}
          className={`${controls.button} ${controls.primary} ${styles.centeredAction}`}
        >
          {isCreating ? "Adding…" : "Add preset"}
        </button>
      </div>

      {isLoading && <p className={styles.status}>Loading presets…</p>}
      <ul className={styles.list}>
        {presets.map((preset) => {
          const id = preset.presetId;
          const isEditing = editingPresetId === id;

          return (
            <li className={styles.item} key={id}>
              <input
                className={`${controls.field} ${styles.itemInput}${
                  isEditing ? ` ${styles.itemInputEditing}` : ""
                }`}
                value={isEditing ? editingTitle : preset.title}
                readOnly={!isEditing}
                disabled={busyId === id}
                aria-label={`Preset title: ${preset.title}`}
                onChange={(event) => setEditingTitle(event.target.value)}
                onClick={() => {
                  if (!isEditing) onAppend(preset.text);
                }}
                onBlur={() => {
                  if (isEditing) void saveTitle(preset);
                }}
                onMouseDown={(event) => {
                  if (!isEditing) event.preventDefault();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isEditing) {
                    event.preventDefault();
                    void saveTitle(preset);
                  } else if (event.key === "Escape" && isEditing) {
                    event.preventDefault();
                    setEditingPresetId(null);
                    setEditingTitle(preset.title);
                  }
                }}
                ref={(element) => {
                  inputRefs.current[id] = element;
                }}
              />
              <button
                ref={(element) => {
                  actionTriggerRefs.current[id] = element;
                }}
                type="button"
                className={`${controls.button} ${controls.icon} ${styles.actionsToggle}`}
                onClick={() => setOpenMenuId(openMenuId === id ? null : id)}
                aria-label={`Actions for ${preset.title}`}
                aria-expanded={openMenuId === id}
                aria-controls={`preset-actions-${id}`}
              >
                <span aria-hidden="true">⋮</span>
              </button>
              {openMenuId === id && (
                <SidebarItemMenu
                  id={`preset-actions-${id}`}
                  anchor={actionTriggerRefs.current[id]}
                  label={`Actions for ${preset.title}`}
                  onDismiss={() => setOpenMenuId(null)}
                >
                  <button
                    type="button"
                    onClick={() => enterEditMode(preset)}
                    className={`${controls.button} ${styles.actionButton}`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(id)}
                    disabled={busyId === id}
                    className={`${controls.button} ${styles.actionButton}`}
                  >
                    Delete
                  </button>
                </SidebarItemMenu>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
