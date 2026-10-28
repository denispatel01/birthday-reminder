/* Service worker — offline cache (network-first, cache-busting) */
const CACHE = "birthday-reminder-v15";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=183",
  "app.js?v=183",
  "data.js?v=183",
  "manifest.webmanifest",
  "icons/icon-192.png?v=183",
  "icons/icon-512.png?v=183",
  "icons/apple-touch-icon.png?v=183",
  "icons/favicon-32.png?v=183"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Network-first, bypassing the HTTP cache so updates always reach the device.
  // Falls back to the cached copy when offline.
  e.respondWith(
    fetch(req, { cache: "no-store" }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html")))
  );
});
