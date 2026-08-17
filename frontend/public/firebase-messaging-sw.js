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

self.addEventListener('notificationclick', (event) => {
  console.log('[FCM] Notification clicked:', event);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(url));
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[FCM] Notification dismissed:', event.notification.tag);
});