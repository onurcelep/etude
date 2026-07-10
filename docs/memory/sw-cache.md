# Looper service worker cache behavior

Learned: 2026-07-10 (re-verify before acting if the area has changed)

`looper/sw.js` uses a named cache (`etude-looper-vN`). Navigation is
network-first (updates show when online); static assets are cache-first,
so a changed asset stays invisible to existing clients until the `CACHE`
constant is bumped — the activate step then deletes all other caches.
The service worker is not registered on `localhost`/`file:` (local edits
always show); it registers only on the deployed origin. On the iPad,
reload twice or use a Private tab to get past an old cache.
