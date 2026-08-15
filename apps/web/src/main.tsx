import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { webThemeVariables } from "@cyberblade/design-system";
import { App } from "./App";
import "./styles.css";

for (const [name, value] of Object.entries(webThemeVariables())) {
  document.documentElement.style.setProperty(name, value);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
