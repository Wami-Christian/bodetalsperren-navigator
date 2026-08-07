const CACHE_VERSION = "harzfishing-v5.3-pwa-1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("harzfishing-") &&
                key !== STATIC_CACHE &&
                key !== RUNTIME_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Kartenkacheln werden bewusst NICHT dauerhaft gecacht.
  // So vermeiden wir veraltete Karten und unnötigen Speicherverbrauch.
  if (
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("tile.openstreetmap")
  ) {
    return;
  }

  // Navigation: Netzwerk zuerst, bei fehlender Verbindung App-Shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("/"))
          );
        })
    );
    return;
  }

  // Eigene statische Dateien: Cache zuerst, Netzwerk als Fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;

        try {
          const response = await fetch(request);

          if (response.ok) {
            const copy = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy));
          }

          return response;
        } catch {
          return new Response("", {
            status: 503,
            statusText: "Offline"
          });
        }
      })
    );
  }
});
