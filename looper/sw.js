/* Etude Looper service worker: offline app shell (scope /looper/).
   Bump CACHE when you want clients to refresh cached assets.
   The activate step deletes any other cache (including the old root 'etude-v5'). */
const CACHE = 'etude-looper-v17';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './signalsmith-stretch.mjs',
                './mov-audio.js', './capture-worklet.js',
                './fonts/fraunces-roman.woff2', './fonts/fraunces-italic.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    // Network-first for the page so updates show when online; fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    // Cache-first for static assets.
    e.respondWith(
      caches.match(req).then((r) => r || fetch(req).then((resp) => {
        const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return resp;
      }))
    );
  }
});
