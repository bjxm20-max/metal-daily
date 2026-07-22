// Metal Daily — service worker (network-first no shell + dados frescos)
const CACHE = 'metal-daily-v7';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './data.json', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
// network-first para navegação, index.html e data.json (apanha sempre código/dados novos);
// cache-first só para ícones e manifest.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isShell = e.request.mode === 'navigate'
    || url.pathname.endsWith('/') || url.pathname.endsWith('index.html')
    || url.pathname.endsWith('styles.css') || url.pathname.endsWith('app.js')
    || url.pathname.endsWith('data.json');
  if (isShell) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html')))
    );
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
