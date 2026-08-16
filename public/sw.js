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

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "daily";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: payload.url || "/",
      medicationId: payload.medicationId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = event.notification.data?.url || "/";
  const targetUrl = new URL(targetPath, self.location.origin).href;
  const hasQuery = targetPath.includes("?");

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        if (!hasQuery) {
          for (const client of clientList) {
            if (
              new URL(client.url).origin === self.location.origin &&
              "focus" in client
            ) {
              return client.focus();
            }
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      }),
  );
});