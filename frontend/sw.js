const CACHE_NAME = "meu-drive-pwa-v3"; // <- aumente o número sempre que mexer
const ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./manifest.json",
  "./styles.css?v=20260211",
  "./app.js?v=20260211",
  "./dashboard.js?v=20260211"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // HTML: network-first (se offline, cai no cache)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./dashboard.html"))
    );
    return;
  }

  // JS/CSS: cache-first (mas com versões ?v=... sempre atualiza quando você muda o v)
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
