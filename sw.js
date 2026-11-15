// Mikra Cambios — service worker (para instalarla como app y recibir los avisos)
// La página SIEMPRE se baja de internet (así nunca queda una versión vieja);
// la copia guardada se usa solo si no hay conexión. La nube y ML (workers.dev) no se tocan.
const CACHE = 'mikra-cambios-v2';
const ARCHIVOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './badge-96.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;   // nube / ML: directo
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ── Avisos (lun–vie 10:00 y 13:00, los manda el Worker mikra-historial) ──
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '🔁 Cambios', {
    body: d.body || 'Tenés cambios para hacer hoy',
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    tag: d.tag || 'cambios',
    renotify: true,
    data: { url: d.url || './' },
  }));
});

// Tocar el aviso → abre la app (o la trae al frente si ya estaba abierta)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.registration.scope));
    return w ? w.focus() : self.clients.openWindow(url);
  }));
});
