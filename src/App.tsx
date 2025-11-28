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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "100vh", overflow: "hidden" }}> {/* prevent whole window scr */}
      <div className="left-pane" style={{ borderRight: "1px solid #eee", display: "grid", gridTemplateRows: "1fr 1fr", paddingRight: "16px", overflowY: "auto" }}> {/* Left pane */}
        <ThreadList onSelect={id => setThreadId(id)} />
        <PresetList onAppend={text => setPresetAppend(prev => prev === text ? `${text} ` : text)} />
      </div>
      <div style={{ height: "100%", width: "100%", overflowY: "auto", display: "flex", justifyContent: "center", alignItems: "center" }}> {/* Right pane with independent scrolling */}
        {threadId ?
          <ChatPane
            threadId={threadId}
            presetAppend={presetAppend}
            onPresetApplied={() => setPresetAppend("")} // Clear presetAppend after 1 use
          />
          :
          <div>Select or create a thread</div>
        }
      </div>
    </div>
  );
}


/*
export default function App() {
  return <h1>Hello, World!</h1>;
}*/

/*
import { useState } from "react";
import ThreadList from "./components/ThreadList";

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "100vh" }}>
      <div style={{ borderRight: "1px solid #eee" }}>
        <ThreadList onSelect={id => setThreadId(id)} />
      </div>
      <div>
        {threadId ? <div>Thread selected: {threadId}</div> : <div>Select or create a thread</div>}
      </div>
    </div>
  );
}
*/

/*
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
*/
