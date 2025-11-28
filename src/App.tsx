/*
    App.tsx — layout wiring
    
    todo (left sidebar split: threads/presets; main chat)
*/

import { useState } from "react";
import ThreadList from "./components/ThreadList";
import PresetList from "./components/PresetList";
import ChatPane from "./components/ChatPane";
import './App.css'

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [presetAppend, setPresetAppend] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to toggle the left pane

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", height: "100vh", overflow: "hidden" }}>
      {/* Menu Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 1000,
          background: "#e9e9e9ff",
          color: "#000000ff",
          border: "none",
          borderRadius: "4px",
          padding: "8px 12px",
          cursor: "pointer",
          outline: "2px solid #757575ff", // Outline color around the menu button
          outlineOffset: "0px", // Add spacing between the outline and the button
          //fontSize: "7px",
          width: "14px", // Set a fixed width
          height: "20px", // Set a fixed height
          display: "flex", // Center the text/icon inside the button
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        ︙
      </button>

      {/* Left pane: ThreadList and PresetList */}
      <div
        className="left-pane"
        style={{
          position: "absolute",
          top: 0,
          left: isMenuOpen ? 0 : "-330px", // Slide in/out based on `isMenuOpen`
          width: "320px",
          height: "100%",
          borderRight: "1px solid #eee",
          display: "grid",
          gridTemplateRows: "1fr 1fr",
          paddingRight: "16px",
          overflowY: "auto",
          transition: "left 0.3s ease", // Smooth sliding animation
          zIndex: 999, // Ensure it overlaps the chat pane
        }}
      >
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
  );
}
