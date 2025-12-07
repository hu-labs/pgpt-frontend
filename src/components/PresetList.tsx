/*
        Preset CRUD
*/

import { useState } from "react";
import { load, save } from "../lib/storage";
import type { Preset } from "../types";

export default function PresetList(
  { onAppend, isMenuOpen }: { onAppend: (text: string) => void, isMenuOpen: boolean }
) {
  const [store, setStore] = useState(load());
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

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
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
      ),
    };
    setStore(next);
    save(next);
  }

  function deletePreset(id: string) {
    const next = { ...store, presets: store.presets.filter((p) => p.id !== id) };
    setStore(next);
    save(next);
  }

  return (
    <div>
      <div style={{ textAlign: "center" }}>
        <h4 style={{ color: "#aaaaaaff" }}>Prompt Presets</h4>

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
          style={{ display: "block", margin: "0 auto", marginBottom: "8px", resize: "vertical" }}
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
          <li key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <input
              className="threadInput"
              defaultValue={p.title}
              onBlur={(e) => updatePreset(p.id, { title: e.target.value })}
              style={{ width: "100%" }}
              tabIndex={isMenuOpen ? 0 : -1}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "4px", marginBottom: "4px" }}>
              <button
                onClick={() => onAppend(p.text)}
                className="minor-button"
                tabIndex={isMenuOpen ? 0 : -1}
              >
                Use
              </button>
              <button
                onClick={() => deletePreset(p.id)}
                className="minor-button"
                tabIndex={isMenuOpen ? 0 : -1}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
