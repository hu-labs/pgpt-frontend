/*
        Preset CRUD
*/

import { useState, useRef } from "react";
import { load, save } from "../lib/storage";
import { useClickOutside } from "../lib/useClickOutside";
import type { Preset } from "../types";

export default function PresetList({
  onAppend,
  isMenuOpen,
}: {
  onAppend: (text: string) => void;
  isMenuOpen: boolean;
}) {
  const [store, setStore] = useState(load());
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
    const next = { ...store, presets: [p, ...store.presets] };
    setStore(next);
    save(next);
    setTitle("");
    setText("");
  }

  function updatePreset(id: string, patch: Partial<Preset>) {
    const next = {
      ...store,
      presets: store.presets.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    };
    setStore(next);
    save(next);
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
    const next = {
      ...store,
      presets: store.presets.filter((p) => p.id !== id),
    };
    setStore(next);
    save(next);
  }

  return (
    <div>
      <div style={{ textAlign: "center" }}>
        <h4 style={{ color: "var(--color-text-muted)" }}>Prompt Presets</h4>

        <input
          className="threadInput"
          placeholder="Prompt title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ display: "block", margin: "0 auto", marginBottom: "8px" }}
          tabIndex={isMenuOpen ? 0 : -1}
        />

        <textarea
          className="threadInput"
          placeholder="Prompt you want to save"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            display: "block",
            margin: "0 auto",
            marginBottom: "8px",
            resize: "vertical",
          }}
          tabIndex={isMenuOpen ? 0 : -1}
        />

        <div style={{ marginTop: "8px" }}>
          <button
            onClick={createPreset}
            className="major-button"
            style={{ display: "block", margin: "2px auto 14px" }}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            Add preset
          </button>
        </div>
      </div>

      <ul>
        {store.presets.map((p) => (
          <li
            key={p.id}
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
              defaultValue={p.title}
              readOnly={editingPresetId !== p.id}
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
              style={{
                flex: 1,
                cursor: editingPresetId === p.id ? "text" : "pointer",
              }}
              tabIndex={isMenuOpen ? 0 : -1}
            />
            <button
              onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
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
            {openMenuId === p.id && (
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
                    enterEditMode(p.id);
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
                    deletePreset(p.id);
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
