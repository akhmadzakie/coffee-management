import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { ErrorBoundary } from "./components/ErrorBoundary";

// Menangani stale chunk setelah deploy baru di production (Railway/Vite)
window.addEventListener("vite:preloadError", () => {
  const lastReload = sessionStorage.getItem("vite_chunk_reload");
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem("vite_chunk_reload", now.toString());
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

