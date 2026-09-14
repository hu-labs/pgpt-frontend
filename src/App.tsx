/*
    App.tsx
    
    Layout wiring together ThreadList, PresetList, and ChatPane
*/

import { useState } from "react";
import ThreadList from "./components/ThreadList";
import PresetList from "./components/PresetList";
import ChatPane from "./components/ChatPane";
import controls from "./components/Controls.module.css";
import styles from "./App.module.css";

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [presetAppend, setPresetAppend] = useState<string>("");
  const [presetTrigger, setPresetTrigger] = useState(0); // Trigger for preset append
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to toggle the left pane

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={`${controls.button} ${controls.icon} ${styles.mobileMenuButton}`}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
        aria-controls="app-sidebar"
      >
        <span className={styles.menuIcon} aria-hidden="true">
          <span className={styles.menuIconLine} />
        </span>
      </button>

      {isMenuOpen && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        id="app-sidebar"
        className={`${styles.sidebar}${isMenuOpen ? ` ${styles.sidebarOpen}` : ""}`}
        aria-label="Threads and prompt presets"
      >
        <button
          type="button"
          className={`${controls.button} ${controls.icon} ${styles.sidebarClose}`}
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
        >
          &times;
        </button>

        <ThreadList onSelect={(id) => setThreadId(id)} />
        <PresetList
          onAppend={(text) => {
            setPresetTrigger((prev) => prev + 1); // Increment trigger
            setPresetAppend(text);
          }}
        />
      </aside>

      <main className={styles.main}>
        {threadId ? (
          <ChatPane
            threadId={threadId}
            presetAppend={presetAppend}
            presetTrigger={presetTrigger} // Pass the trigger
            onFocus={() => setIsMenuOpen(false)} // Collapse the left pane when ChatPane gains focus
          />
        ) : (
          <div className={styles.emptyState}>Select or create a thread</div>
        )}
      </main>
    </div>
  );
}
