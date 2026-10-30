const CACHE_NAME = "julias-management-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/pos",
  "/kds",
  "/manifest.json",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/logo-wordmark-white.png",
];

// Install event: Precache core shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("SW precache partial warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first for dynamic code & assets with robust cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass API calls, websockets, and non-GET requests
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // 1. Navigation requests (HTML page loads / reloads when offline)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fallback to cached version of the page, or root index.html
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
          const indexCached = await caches.match("/index.html");
          if (indexCached) return indexCached;
          return new Response(
            "<!doctype html><html><body style='font-family:sans-serif;text-align:center;padding:40px;'><h2>Julia's POS Sedang Offline</h2><p>Pastikan Anda sudah membuka POS sebelumnya agar tersimpan di memori perangkat.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 2. Static assets & scripts (JS bundles, CSS, images, fonts)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful static responses (supports basic & cors, e.g. Google Fonts)
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === "opaque")
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        return new Response("Offline Asset Unavailable", {
          status: 503,
          statusText: "Offline",
        });
      })
  );
});
