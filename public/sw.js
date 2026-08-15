self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { pathname } = new URL(event.request.url);

  if (pathname.startsWith("/api/notion/")) {
    event.respondWith(fetch(event.request));
  }
});