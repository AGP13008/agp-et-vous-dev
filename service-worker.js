const CACHE = 'agp-v3-4-0';
const FILES = ['./','index.html','styles.css','app.js','firebase-config.js','manifest.json','assets/icon-192.png','assets/icon-512.png','assets/logo.jpg','assets/tour.jpg','assets/drone.jpg','assets/prado.jpg'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)));
});
