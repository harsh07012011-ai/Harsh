const CACHE_NAME = "foundation-plan-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.25.6/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url, { mode: "no-cors" })
            .then((res) => cache.put(url, res))
            .catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Handles taps on the persistent timer notification (and the weekend revisit reminder).
// If the app is open in any client, we just post a message so it can stop the timer
// in place. If nothing is open, we open/focus a window; the app itself detects the
// ?stopTimer=1 flag on load and finishes saving the session.
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const isTimerNotif = notification.tag === "active-timer";
  const isStopAction = event.action === "stop";
  notification.close();

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    if (isTimerNotif && (isStopAction || !event.action)) {
      if (allClients.length > 0) {
        allClients.forEach((client) => client.postMessage({ type: "STOP_TIMER" }));
        allClients[0].focus();
        return;
      }
      // App is fully closed — open it with a flag so it can stop & save the timer itself.
      await self.clients.openWindow("./index.html?stopTimer=1");
      return;
    }

    // Any other notification (e.g. gap reminder): just bring the app to the front.
    if (allClients.length > 0) { allClients[0].focus(); return; }
    await self.clients.openWindow("./index.html");
  })());
});
