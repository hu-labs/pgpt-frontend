/*
    App.tsx — layout wiring
    
    todo (left sidebar split: threads/presets; main chat)
*/

import { useEffect, useState } from "react";
import ThreadList from "./components/ThreadList";
import PresetList from "./components/PresetList";
import ChatPane from "./components/ChatPane";
import './App.css'

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [presetAppend, setPresetAppend] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to toggle the left pane
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.innerHeight); // Dynamically update the height
    };

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div style={{ height: `${viewportHeight}px`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top strip */}
      <div style={{ height: "34px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", backgroundColor: "#888", borderBottom: "1px solid #eee" }}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="hamburger-button"
          style={{
            padding: "0px 0px",
            cursor: "pointer" }}
        >
          <span className="hamburger-bar"></span>
        </button>
        <div style={{ fontWeight: "bold", color: "#f8f8f8ff" }}>PromptGPT</div>
        <div style={{ fontSize: "12px", color: "#666" }}>v1.1</div>
      </div>

      {/* Bottom pane */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr", overflow: "hidden" }}>
        {/* Left pane: ThreadList and PresetList */}
        <div
          className="left-pane"
          style={{
            boxSizing: "border-box",
            position: "absolute",
            top: 0,
            left: isMenuOpen ? 0 : "-296px", // Slide in/out based on `isMenuOpen`
            width: "300px",
            height: "100%",
            borderRight: "1px solid #eee",
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            padding: "22px 28px",
            overflowY: "auto",
            transition: "left 0.3s ease", // Smooth sliding animation
            zIndex: 999, // Ensure it overlaps the chat pane
          }}
        >
          {/* Close button */}
          <button
            className="close-button"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
            style={{
              position: "absolute",
              top: "2px",
              left: "15px",
              zIndex: 1001, // Ensure it appears above the left pane
            }}
          >
            &times;
          </button>

          <ThreadList onSelect={id => setThreadId(id)} />
          <PresetList onAppend={text => setPresetAppend(prev => prev === text ? `${text} ` : text)} />
        </div>

        {/* Right pane */}
        <div style={{ height: "100%", width: "100%",
                      overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {threadId ?
            <ChatPane
              threadId={threadId}
              presetAppend={presetAppend}
              onPresetApplied={() => setPresetAppend("")} // Clear presetAppend after 1 use
              onFocus={() => setIsMenuOpen(false)} // Collapse the left pane when ChatPane gains focus
            />
            :
            <div style={{ display: "flex", justifyContent: "center",
                          alignItems: "center", height: "100%", width: "100%",
            }}>Select or create a thread</div>
          }
        </div>
      </div>
    </div>
  );
}
