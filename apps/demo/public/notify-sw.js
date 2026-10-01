/**
 * Service worker for the playground's notification demo.
 *
 * Registered by `notifyPlugin` via its `serviceWorkerUrl` option. Before this
 * file grew a `push` handler it only did `skipWaiting`/`claim` — enough to
 * register, useless for notifications: iOS 16.4+ delivers Web Push through a
 * service worker's `push` event, so a worker without one cannot show a
 * notification from a Home Screen install at all.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A non-JSON push body is normal; fall back to plain text below.
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Alpine.js Toolkit";
  const options = {
    body: payload.body || "Notification permission granted",
    icon: payload.icon || "/logo.svg",
    badge: payload.badge || "/logo.svg",
    // `tag` collapses repeat deliveries of the same notification on iOS,
    // which otherwise stacks duplicates in the tray.
    tag: payload.tag || "alpine-toolkit",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab rather than piling up new ones.
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client && client.url !== target) {
            return client.navigate(target).then((navigated) => navigated?.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
