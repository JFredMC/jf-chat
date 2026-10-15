// Velo · Web Push worker. It only shows a notification: no caching, no data.
// The payload is just a random code ({ "code": "483920" }); the notification
// shows only that code as its title: no body, no icon, no badge, no image and
// no data (nothing to open). The OS/browser may still add its own name line.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let code = '';
  try {
    code = String((event.data && event.data.json().code) || '')
      .replace(/\D/g, '')
      .slice(0, 8);
  } catch (e) {
    code = '';
  }
  event.waitUntil(
    self.registration.showNotification(code || '••••••', {
      body: '',
      tag: 'n',
      renotify: true,
    }),
  );
});

// Tapping the notice only dismisses it: it opens nothing, so a glance at the
// phone never lands on the chat.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
});
