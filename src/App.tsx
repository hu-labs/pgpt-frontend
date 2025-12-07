/*
    App.tsx
    
    Layout wiring together ThreadList, PresetList, and ChatPane
*/

import { useEffect, useState } from "react";
import ThreadList from "./components/ThreadList";
import PresetList from "./components/PresetList";
import ChatPane from "./components/ChatPane";
import './App.css'

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [presetAppend, setPresetAppend] = useState<string>("");
  const [presetTrigger, setPresetTrigger] = useState(0); // Trigger for preset append
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to toggle the left pane
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => { // Check this later if it's sensible on phones
    const updateHeight = () => setViewportHeight(window.innerHeight); // Dynamically update the height
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div style={{ height: `${viewportHeight}px`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top strip */}
      <div className="app-title-bar">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="hamburger-button"
          aria-label="Menu button"
          style={{
            padding: "0px 0px",
            cursor: "pointer" }}
        >
          <span className="hamburger-bar"></span>
        </button>
        <div className="app-title">PromptGPT</div>
        <div style={{ fontSize: "12px", color: "#30498dff" }}>v1.2</div>
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
          tabIndex={-1}
        >
          {/* Close button */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="close-button"
            aria-label="Close menu button"
            style={{
              position: "absolute",
              top: "2px",
              left: "15px",
              zIndex: 1001, // Ensure it appears above the left pane
            }}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            &times;
          </button>

          <ThreadList onSelect={id => setThreadId(id)}
                      isMenuOpen={isMenuOpen}
          />
          <PresetList onAppend={(text) => {
                        setPresetTrigger((prev) => prev + 1); // Increment trigger
                        setPresetAppend(text);
                      }}
                      isMenuOpen={isMenuOpen}
          />
        </div>

        {/* Right pane */}
        <div style={{ height: "100%", width: "100%",
                      overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {threadId ?
            <ChatPane
              threadId={threadId}
              presetAppend={presetAppend}
              presetTrigger={presetTrigger} // Pass the trigger
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
