// Weered Service Worker — caching + push notifications
const CACHE = "weered-v1";
const SHELL_URLS = ["/home", "/lobby"];

// ── Install: pre-cache app shell ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches, claim clients ────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls or WebSocket
  if (url.pathname.startsWith("/api") || url.protocol === "ws:" || url.protocol === "wss:") return;
  if (event.request.method !== "GET") return;

  // Static assets (JS/CSS/images): cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Navigation: network-first with cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("/home")))
    );
    return;
  }
});

// ── Push notification handler ────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Weered", {
      body: data.body || "",
      icon: "/brand/logo/weered-logo-128.png",
      badge: "/brand/logo/weered-logo-128.png",
      tag: data.tag || "weered",
      data: { url: data.url || "/home" },
    })
  );
});

// ── Notification click — focus or open window ────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
