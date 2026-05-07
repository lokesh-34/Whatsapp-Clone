// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
const swConfig = {
  apiKey: "REPLACED_BY_RUNTIME", // Not strictly needed for background SW usually
  messagingSenderId: "REPLACED_BY_RUNTIME",
}

const isPlaceholderConfig = Object.values(swConfig).some((v) => !v || v === 'REPLACED_BY_RUNTIME')

if (!isPlaceholderConfig) {
  try {
    firebase.initializeApp(swConfig)
    const messaging = firebase.messaging()

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload)

      const notificationTitle = payload.notification?.title || payload.data?.senderName || 'New Message'
      const notificationOptions = {
        body: payload.notification?.body || 'Check your messages.',
        icon: '/logo192.png',
        tag: 'whatsapp-clone-notification',
        data: payload.data,
      }

      self.registration.showNotification(notificationTitle, notificationOptions)
    })
  } catch (e) {
    // Never crash SW evaluation: push notifications are optional.
    console.warn('[firebase-messaging-sw.js] Firebase init failed:', e?.message || e)
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = '/'; // Or a specific chat URL if you pass senderId in data

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});