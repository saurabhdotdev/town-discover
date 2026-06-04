const CACHE_VERSION = "v1";
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const PAGE_CACHE = `page-cache-${CACHE_VERSION}`;
const API_CACHE = `api-cache-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/favicon.ico",
  "/globals.css",
  "/discover",
  "/events",
  "/map",
  "/profile",
  "/trip",
  "/leaderboard",
];

// Install Event - Pre-cache critical pages/assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[Service Worker] Pre-caching offline skeleton pages");
      // Add assets individually to prevent the whole promise from rejecting if one is missing
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) => cache.add(asset))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== PAGE_CACHE &&
            cacheName !== API_CACHE
          ) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Intercept requests and apply caching strategies
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Strategy for API requests (Network First, fallback to Cache)
  if (url.pathname.startsWith("/api/")) {
    const shouldCacheApi = 
      url.pathname.includes("/saved-places") ||
      url.pathname.includes("/trip-plans") ||
      url.pathname.includes("/places/surroundings") ||
      url.pathname.includes("/notifications") ||
      url.pathname.includes("/events/live");

    if (shouldCacheApi) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(API_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            console.log("[Service Worker] Offline API request. Serving from cache:", url.pathname);
            return caches.match(request);
          })
      );
    }
    return;
  }

  // Strategy for static resources / pages / assets (Cache First)
  const isStaticAsset =
    url.pathname.includes("/_next/") ||
    url.pathname.includes("/images/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Strategy for HTML pages (Network First, fallback to Page Cache)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        console.log("[Service Worker] Offline page load. Serving from cache:", url.pathname);
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to the offline fallback shell (homepage)
          return caches.match("/");
        });
      })
  );
});
