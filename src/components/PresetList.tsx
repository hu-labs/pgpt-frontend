/*
        Preset CRUD
*/

import { useState, useRef } from "react";
import { useStore } from "../lib/storage";
import { useClickOutside } from "../lib/useClickOutside";
import type { Preset } from "../types";
import controls from "./Controls.module.css";
import styles from "./SidebarList.module.css";

export default function PresetList({
  onAppend,
}: {
  onAppend: (text: string) => void;
}) {
  const [store, setStore] = useStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const presetInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpenMenuId(null));

  function createPreset() {
    const p: Preset = {
      id: crypto.randomUUID(),
      title,
      text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setStore((prev) => ({ ...prev, presets: [p, ...prev.presets] }));
    setTitle("");
    setText("");
  }

  function updatePreset(id: string, patch: Partial<Preset>) {
    setStore((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }));
    setEditingPresetId(null);
  }

  function enterEditMode(id: string) {
    setEditingPresetId(id);
    setOpenMenuId(null);
    setTimeout(() => {
      const input = presetInputRefs.current[id];
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function deletePreset(id: string) {
    setStore((prev) => ({
      ...prev,
      presets: prev.presets.filter((p) => p.id !== id),
    }));
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
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className={controls.visuallyHidden} htmlFor="preset-text">
          Prompt to save
        </label>
        <textarea
          id="preset-text"
          className={controls.field}
          placeholder="Prompt you want to save"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          type="button"
          onClick={createPreset}
          className={`${controls.button} ${controls.primary} ${styles.centeredAction}`}
        >
          Add preset
        </button>
      </div>

      <ul className={styles.list}>
        {store.presets.map((p) => (
          <li className={styles.item} key={p.id}>
            <input
              className={`${controls.field} ${styles.itemInput}${
                editingPresetId === p.id ? ` ${styles.itemInputEditing}` : ""
              }`}
              defaultValue={p.title}
              readOnly={editingPresetId !== p.id}
              aria-label={`Preset title: ${p.title}`}
              onClick={() => {
                if (editingPresetId !== p.id) {
                  onAppend(p.text);
                }
              }}
              onBlur={(e) => {
                if (editingPresetId === p.id) {
                  updatePreset(p.id, { title: e.target.value });
                }
              }}
              onMouseDown={(e) => {
                // Prevent text selection when inactive
                if (editingPresetId !== p.id) {
                  e.preventDefault();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editingPresetId === p.id) {
                  const input = e.currentTarget as HTMLInputElement;
                  input.setSelectionRange(0, 0);
                  input.blur();
                } else if (e.key === "Escape" && editingPresetId === p.id) {
                  const input = e.currentTarget as HTMLInputElement;
                  input.value = p.title;
                  input.setSelectionRange(0, 0);
                  setEditingPresetId(null);
                  input.blur();
                }
              }}
              ref={(e) => {
                presetInputRefs.current[p.id] = e;
              }}
            />
            <button
              type="button"
              className={`${controls.button} ${controls.icon} ${styles.actionsToggle}`}
              onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
              aria-label={`Actions for ${p.title}`}
              aria-expanded={openMenuId === p.id}
              aria-controls={`preset-actions-${p.id}`}
            >
              <span aria-hidden="true">⋮</span>
            </button>
            {openMenuId === p.id && (
              <div
                ref={menuRef}
                id={`preset-actions-${p.id}`}
                className={styles.actionsPanel}
              >
                <button
                  type="button"
                  onClick={() => {
                    enterEditMode(p.id);
                  }}
                  className={`${controls.button} ${styles.actionButton}`}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deletePreset(p.id);
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
