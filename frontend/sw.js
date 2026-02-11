const CACHE_NAME = "meu-drive-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./styles.css",
  "./app.js",
  "./dashboard.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // para navegação (abrir páginas), tenta rede e cai no cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./dashboard.html").then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // assets
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

