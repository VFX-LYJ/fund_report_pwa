const CACHE = 'fund-pwa-v23';
const CORE_ASSETS = ['./','./index.html','./style.css','./app.js','./risk-submit.js','./risk-submit.css','./manifest.json','./icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fund-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/')) return;
  event.respondWith(fetch(event.request, {cache:'no-cache'}).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
