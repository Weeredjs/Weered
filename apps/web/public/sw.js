// Weered Service Worker — caching + push notifications
//
// v8: HTML is no longer cached. Only fingerprinted static assets from
// /_next/static/ (immutable by design) and /brand/ images get cached.
// Navigation requests always hit the network so a fresh build's chunk
// hashes arrive together with the HTML that references them. Earlier
// versions pre-cached /home and /lobby and used cache-fallback navigation
// — that caused soft-refresh to serve stale HTML pointing at dead chunks.
const CACHE = "weered-v10";

// ── Install: take over immediately; nothing to pre-cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activate: drop every old cache (purges v7's bad HTML pre-cache),
// then claim all open clients so the new SW is authoritative right away.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ── Fetch strategy ───────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls, WebSocket, or non-GET — pass through.
  if (url.pathname.startsWith("/api") || url.protocol === "ws:" || url.protocol === "wss:") return;
  if (event.request.method !== "GET") return;

  // Fingerprinted static assets: cache-first. Safe — every build emits
  // new filenames, so cached entries either match exactly or are unused.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (HTML navigations, /_next/data/, RSC payloads, etc.)
  // — pass through to the network with no cache write. Eliminates the
  // soft-refresh stale-HTML bug entirely.
});

// ── Push notification handler ────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      // If any client window for this origin is focused, suppress the loud
      // browser notification — postMessage to all clients so they bump the
      // tab title / favicon / play chime instead. Quiet UX when the user
      // is already looking at us; full notification only when they aren't.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const anyFocused = clients.some((c) => c.focused);
      if (anyFocused) {
        for (const c of clients) {
          try {
            c.postMessage({ type: "weered:push-suppressed", data });
          } catch {}
        }
        return;
      }
      await self.registration.showNotification(data.title || "Weered", {
        body: data.body || "",
        icon: "/brand/logo/weered-logo-128.png",
        badge: "/brand/logo/weered-logo-128.png",
        tag: data.tag || "weered",
        data: { url: data.url || "/home" },
      });
    })(),
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
    }),
  );
});
