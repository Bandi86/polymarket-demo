// Service Worker for PWA support
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "polymarket-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/styles/generated.css",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API requests
  if (event.request.url.includes("/api/")) return;

  // Skip WebSocket requests
  if (event.request.headers.get("accept")?.includes("text/event-stream")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        // Update cache in background
        fetch(event.request)
          .then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          })
          .catch(() => {
            // Ignore network errors
          });
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Background sync for offline trades
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-trades") {
    event.waitUntil(syncTrades());
  }
});

async function syncTrades() {
  // Retrieve pending trades from IndexedDB
  // This would need to be implemented with actual IndexedDB access
  console.log("Syncing pending trades...");
}

// Push notification support
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options: NotificationOptions = {
    body: data.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: data.tag || "default",
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Polymarket", options)
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = "/";

  if (data?.action === "trade") {
    url = "/?action=trade";
  } else if (data?.action === "portfolio") {
    url = "/?action=portfolio";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Periodic background sync for market data
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "market-data") {
    event.waitUntil(fetchMarketData());
  }
});

async function fetchMarketData() {
  try {
    const response = await fetch("/api/market");
    const data = await response.json();
    // Store in cache for offline access
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      "/api/market",
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    console.error("Failed to fetch market data:", error);
  }
}

export {};
