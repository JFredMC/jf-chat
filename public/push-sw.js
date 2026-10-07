// Velo · Web Push worker. It only shows a notification: no caching, no data.
// The payload is just a random code ({ "code": "483920" }); the notification
// never says who wrote or what, and uses the neutral "Notas" icon.
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
      tag: 'velo',
      renotify: true,
      icon: 'icons/notas-192.png',
      badge: 'icons/notas-192.png',
      data: {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
