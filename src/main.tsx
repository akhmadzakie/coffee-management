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

// Register PWA Service Worker for offline capability & tablet installation
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Auto update service worker on new deployment
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("Versi baru aplikasi terinstal di perangkat.");
              }
            });
          }
        });
      })
      .catch((err) => {
        console.log("PWA Service Worker registration skipped:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


