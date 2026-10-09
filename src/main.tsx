import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./theme.css";
import "./index.css";
import "./auth";

import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
