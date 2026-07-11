self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Card Pone 시세 알림', {
    body: payload.body || '등록한 카드의 시세 조건이 충족되었습니다.',
    icon: payload.icon || '/card-pone-app-icon-192.png',
    badge: '/card-pone-app-icon-192.png',
    tag: payload.tag || 'card-pone-price-alert',
    renotify: true,
    data: { url: payload.url || '/prices' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/prices', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) await client.navigate(targetUrl);
      return client.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
