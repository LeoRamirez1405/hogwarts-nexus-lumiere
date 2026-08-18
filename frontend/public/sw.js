/**
 * Service Worker for Hogwarts Nexus Lumière PWA
 * Handles: Push notifications (FCM), offline caching, background sync
 *
 * SINGLE-SW strategy: Firebase Messaging runs inside THIS worker. Registering
 * a second worker (/firebase-messaging-sw.js) at the same scope "/" makes one
 * of them redundant, and pushManager.subscribe() on a redundant registration
 * fails with "AbortError: Registration failed - push service error" (code 20).
 */

// Firebase Messaging (compat) — must run before anything else uses messaging.
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDJcEB8PnUA_7RyZEI9E-oGv5qRfRoX--U",
  authDomain: "nexus-13780.firebaseapp.com",
  projectId: "nexus-13780",
  storageBucket: "nexus-13780.firebasestorage.app",
  messagingSenderId: "22980815550",
  appId: "1:22980815550:web:de1854bf9b39e4bfa98cef",
  measurementId: "G-3LFFMR42JS"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-owl.svg',
    badge: '/icons/badge-owl.svg',
    image: payload.notification?.image,
    data: {
      url: payload.data?.url || '/notifications',
      ...payload.data
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Descartar' }
    ],
    requireInteraction: true,
    tag: payload.collapseKey || 'nexus-fcm-notification'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Bumped to v4 (cache v7): API GETs move from networkFirst to
// stale-while-revalidate so views paint instantly from the local cache while
// fresh data is fetched in the background — the backend (Render free) sleeps
// after 15 min idle, so a cold-start round trip would otherwise block every
// first paint. Auth endpoints stay on the network (never cached).
const CACHE_NAME = 'nexus-lumiere-v7';
const STATIC_ASSETS = [
  '/manifest.json',
  '/offline.html',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fallback to cache (for Next.js build assets)
  networkFirst: ['/_next/static/'],
  // Cache first, fallback to network (for static assets)
  cacheFirst: ['/icons/', '/fallbacks/'],
  // Stale while revalidate: serve cached instantly, refresh in background
  // (for API GETs and pages)
  staleWhileRevalidate: ['/api/', '/'],
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => sweepApiCache())
  );
  // IMPORTANT: do NOT call clients.claim() here. Claiming takes control of
  // already-open pages mid-load, which fires `controllerchange` in the page.
  // Combined with a page-side reload, that races the initial load on iOS
  // Safari and leaves the tab showing "This page couldn't load" for every
  // subsequent HTML navigation. Without claim, the SW only controls pages
  // loaded AFTER activation: no mid-session control switch, no race.
});

// Bound the API cache: stale-while-revalidate accumulates per-user responses
// (chats, catalogs, feeds), so drop entries older than 7 days to keep the
// origin quota from filling up.
async function sweepApiCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stale = [];
    for (const req of keys) {
      if (!req.url.includes('/api/')) {
        continue;
      }
      // Drop stale entries AND any prekey responses cached by an older SW
      // version (they are one-time use and must never be served).
      if (req.url.includes('/prekeys')) {
        stale.push(req);
        continue;
      }
      const res = await cache.match(req);
      const date = res ? new Date(res.headers.get('date') || 0).getTime() : 0;
      if (!date || date < cutoff) {
        stale.push(req);
      }
    }
    await Promise.all(stale.map((req) => cache.delete(req)));
  } catch {
    // Sweep is best-effort; never fail activation because of it.
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // NEVER cache auth endpoints. Login/refresh are POSTs (skipped above), but
  // a cached GET here could pin the UI to a stale auth state (e.g. a 401 body
  // cached while the session was being refreshed).
  if (url.pathname.startsWith('/api/auth/')) {
    return;
  }

  // NEVER cache E2E prekeys: they are one-time use and get consumed server-
  // side. Serving a stale batch from cache would fail session initiation for
  // the next message. Identity/signed-prekey (long-lived) may stay cached.
  if (url.pathname.includes('/prekeys')) {
    return;
  }

  // NEVER intercept navigation/document requests. These are auth-gated by the
  // proxy (middleware): serving a cached HTML page here bypasses that check and
  // serves stale app-shell HTML, which caused the /login <-> / redirect loop.
  // Always let navigations hit the network so auth redirects are authoritative.
  if (event.request.mode === 'navigate') {
    return;
  }

  // Never intercept Next.js RSC payload fetches (client-side navigation data).
  // They are consumed once by the router; caching them adds no value and the
  // cloned body race breaks navigations (and Fast Refresh in dev).
  if (url.searchParams.has('_rsc')) {
    return;
  }

  // Determine cache strategy
  let strategy = 'networkFirst';
  for (const [key, paths] of Object.entries(CACHE_STRATEGIES)) {
    if (paths.some((path) => url.pathname.startsWith(path))) {
      strategy = key;
      break;
    }
  }

  switch (strategy) {
    case 'cacheFirst':
      event.respondWith(cacheFirst(event.request));
      break;
    case 'staleWhileRevalidate':
      event.respondWith(staleWhileRevalidate(event.request));
      break;
    case 'networkFirst':
    default:
      event.respondWith(networkFirst(event.request));
      break;
  }
});

/**
 * Cache a GET response (best-effort).
 *
 * IMPORTANT: the response body is a one-shot stream. `response.clone()` must
 * happen *synchronously* here, before any await — as soon as we await (e.g.
 * `caches.open`) the body may already be streamed to the page, and the
 * subsequent clone() throws "Response body is already used", which rejects the
 * fetch promise and breaks the page/API call. Cache writes never fail a
 * request: anything that goes wrong here is swallowed.
 */
function cachePutSafe(request, response) {
  let clone;
  try {
    clone = response.clone();
  } catch {
    return Promise.resolve();
  }
  return caches.open(CACHE_NAME)
    .then((cache) => cache.put(request, clone))
    .catch(() => {});
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cachePutSafe(request, networkResponse);
    }
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    // Nothing to serve: hand back a proper network-error Response. Throwing here
    // rejects respondWith() and logs "resulted in a network error response: the
    // promise was rejected"; Response.error() yields the same network error to
    // the caller without the noisy uncaught rejection.
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Update cache in background
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cachePutSafe(request, networkResponse);
      }
    }).catch(() => {});
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    cachePutSafe(request, networkResponse);
  }
  return networkResponse;
}

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Serve from cache and refresh it in the background.
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          cachePutSafe(request, networkResponse);
        }
      })
      .catch(() => {});
    return cachedResponse;
  }

  // Nothing cached: go to the network. Always resolve to a real Response --
  // returning undefined here is what triggered "Failed to convert value to
  // 'Response'" and broke the request.
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cachePutSafe(request, networkResponse);
    }
    return networkResponse;
  } catch {
    return Response.error();
  }
}

// Update flow: the page posts SKIP_WAITING only when the user explicitly
// accepted an available update (see hooks/usePWA.ts applyUpdate). We never
// force-control a page (no clients.claim()), so the new SW simply becomes
// active and the page reloads once, deliberately, on the user's action.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    // FCM-formatted messages carry a "from" field; they are rendered by the
    // firebase messaging onBackgroundMessage handler above. Skipping them
    // here avoids showing two notifications for the same message.
    if (data.from || data.notification) {
      return;
    }
    const options = {
      body: data.body || 'Nueva notificación',
      icon: data.icon || '/icons/icon-owl.svg',
      badge: '/icons/badge-owl.svg',
      vibrate: data.vibrate || [100, 50, 100],
      tag: data.tag || 'nexus-notification',
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
      data: {
        url: data.url || '/notifications',
        ...data.data,
        dateOfArrival: Date.now(),
      },
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Hogwarts Nexus', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/notifications';

  // Handle action buttons
  if (event.action) {
    // Could handle specific actions here
    console.log('Notification action:', event.action);
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Track notification dismissal if needed
  console.log('Notification closed:', event.notification.tag);
});

// Background Sync (for offline actions)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
  if (event.tag === 'sync-mutations') {
    event.waitUntil(syncMutations());
  }
});

async function syncNotifications() {
  // Could sync offline actions when connection restored
  console.log('Background sync: notifications');
}

async function syncMutations() {
  try {
    const db = await openDB();
    const mutations = await getAllMutations(db);
    console.log(`[SW] Syncing ${mutations.length} offline mutations`);
    
    for (const mutation of mutations) {
      try {
        await fetch(mutation.url, {
          method: mutation.method,
          headers: mutation.headers,
          body: mutation.body,
          credentials: 'include',
        });
        await deleteMutation(db, mutation.id);
} catch (error){
        console.error('[SW] Failed to sync mutation:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// IndexedDB for offline mutation queue
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nexus-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutations', 'readonly');
    const store = tx.objectStore('mutations');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutations', 'readwrite');
    const store = tx.objectStore('mutations');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Helper to queue mutations from the client
self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUEUE_MUTATION') {
    queueMutation(event.data.payload);
  }
});

async function queueMutation(payload) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutations', 'readwrite');
      const store = tx.objectStore('mutations');
      const request = store.add({
        ...payload,
        timestamp: Date.now(),
      });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('[SW] Failed to queue mutation:', error);
  }
}

// Share Target API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    formData.getAll('files');

    // Redirect to a page that handles the shared content
    const shareUrl = `/share-target?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

    return Response.redirect(shareUrl, 303);
  } catch (error) {
    console.error('Share target error:', error);
    return Response.redirect('/', 303);
  }
}