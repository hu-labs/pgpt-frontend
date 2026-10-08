/*
    App.tsx
    
    Layout wiring together ThreadList, PresetList, and ChatPane
*/

import { type CSSProperties, useState } from "react";
import { useStore } from "./lib/storage";
import ThreadList from "./components/ThreadList";
import PresetList from "./components/PresetList";
import ChatPane from "./components/ChatPane";
import controls from "./components/Controls.module.css";
import styles from "./App.module.css";

const DEFAULT_SIDEBAR_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 480;
const SIDEBAR_RESIZE_STEP = 16;

export default function App() {
  const [store] = useStore();
  const [selectedThreadId, setThreadId] = useState<string | null>(null);
  const [presetAppend, setPresetAppend] = useState<string>("");
  const [presetTrigger, setPresetTrigger] = useState(0); // Trigger for preset append
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to toggle the left pane
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  // A deleted selection must immediately fall back to the unloaded state.
  const threadId = store.threads.some(
    (thread) => thread.id === selectedThreadId,
  )
    ? selectedThreadId
    : null;

  function clampSidebarWidth(width: number) {
    const viewportMaximum = Math.floor(window.innerWidth * 0.45);
    return Math.min(
      Math.max(MIN_SIDEBAR_WIDTH, viewportMaximum),
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, width),
    );
  }

  function resizeSidebar(width: number) {
    setSidebarWidth(clampSidebarWidth(width));
  }

  return (
    <div
      className={`${styles.shell}${
        isSidebarCollapsed ? ` ${styles.shellSidebarCollapsed}` : ""
      }${isResizingSidebar ? ` ${styles.shellResizing}` : ""}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
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

      <button
        type="button"
        className={`${controls.button} ${controls.icon} ${styles.desktopExpandButton}${
          isSidebarCollapsed ? ` ${styles.desktopExpandButtonVisible}` : ""
        }`}
        onClick={() => setIsSidebarCollapsed(false)}
        aria-label="Expand sidebar"
        aria-controls="app-sidebar"
        aria-expanded={!isSidebarCollapsed}
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
          className={`${controls.button} ${controls.icon} ${styles.sidebarCollapse}`}
          onClick={() => setIsSidebarCollapsed(true)}
          aria-label="Collapse sidebar"
          aria-controls="app-sidebar"
          aria-expanded={!isSidebarCollapsed}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <button
          type="button"
          className={`${controls.button} ${controls.icon} ${styles.sidebarClose}`}
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
        >
          &times;
        </button>

        <ThreadList
          onSelect={setThreadId}
          onDelete={(id) => {
            setThreadId((selected) => (selected === id ? null : selected));
          }}
        />
        <PresetList
          onAppend={(text) => {
            setPresetTrigger((prev) => prev + 1); // Increment trigger
            setPresetAppend(text);
          }}
        />

        <div
          className={styles.sidebarResizeHandle}
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={clampSidebarWidth(MAX_SIDEBAR_WIDTH)}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsResizingSidebar(true);
          }}
          onPointerMove={(event) => {
            if (isResizingSidebar) resizeSidebar(event.clientX);
          }}
          onPointerUp={(event) => {
            if (!isResizingSidebar) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            setIsResizingSidebar(false);
          }}
          onPointerCancel={() => setIsResizingSidebar(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              resizeSidebar(sidebarWidth - SIDEBAR_RESIZE_STEP);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              resizeSidebar(sidebarWidth + SIDEBAR_RESIZE_STEP);
            } else if (event.key === "Home") {
              event.preventDefault();
              resizeSidebar(MIN_SIDEBAR_WIDTH);
            } else if (event.key === "End") {
              event.preventDefault();
              resizeSidebar(MAX_SIDEBAR_WIDTH);
            }
          }}
        />
      </aside>

      <main className={styles.main}>
        {/* Keep request tracking mounted so replies for other threads can finish. */}
        <ChatPane
          threadId={threadId}
          presetAppend={presetAppend}
          presetTrigger={presetTrigger}
          onFocus={() => setIsMenuOpen(false)} // Collapse the left pane when ChatPane gains focus
        />
        {!threadId && (
          <div className={styles.emptyState}>Select or create a thread</div>
        )}
      </main>
    </div>
  );
}
