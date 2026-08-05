/**
 * Service Worker for Hogwarts Nexus Lumière PWA
 * Handles: Push notifications, offline caching, background sync
 */

// Bumped to v3: fixes the "Response body is already used" clone race (clone
// was happening after `await caches.open()`, by which time the page had
// already consumed the response body) and stops intercepting Next.js RSC
// fetches. v2 purged the v1 HTML cache; we still never cache HTML pages.
const CACHE_NAME = 'nexus-lumiere-v5';
const STATIC_ASSETS = [
  '/manifest.json',
  '/offline.html',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fallback to cache (for API calls)
  networkFirst: ['/api/', '/_next/static/'],
  // Cache first, fallback to network (for static assets)
  cacheFirst: ['/icons/', '/fallbacks/'],
  // Stale while revalidate (for pages)
  staleWhileRevalidate: ['/'],
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
    })
  );
  self.clients.claim();
});

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

// Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nueva notificación',
      icon: data.icon || '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
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