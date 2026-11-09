const OFFLINE_PAGE = "/offline.html";
const CACHE = "obsidian-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("obsidian-offline-") && key !== CACHE).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // Real pages, including authenticated and payment pages, always come from the network.
  event.respondWith(fetch(request).catch(async () =>
    (await caches.open(CACHE)).match(OFFLINE_PAGE).then((page) => page ?? Response.error()),
  ));
});
