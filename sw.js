/* Service Worker — คำขอใช้พื้นที่ป่า ขท.กระบี่ (React v1 / v37) */
const CACHE = 'forest-app-v43';
const BASE = '/forest-permit/';

/* ไฟล์หลักที่ต้อง precache (Vite hash ใน /assets/ จัดการโดย fetch handler) */
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'map.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'apple-touch-icon.png',
];

const CDN_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TILE_HOSTS = ['mt1.google.com', 'tile.openstreetmap.org'];
const TILE_CACHE = 'tiles-v1';

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.2/proj4.min.js',
  'https://unpkg.com/shpjs@4.0.4/dist/shp.js',
  'https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/11.14.5/sweetalert2.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/11.14.5/sweetalert2.all.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) =>
        c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))
          .then(() =>
            Promise.allSettled(
              CDN_ASSETS.map((u) =>
                fetch(new Request(u, { mode: 'no-cors' })).then((r) => c.put(u, r))
              )
            )
          )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  /* tile แผนที่ — cache-first ถาวร */
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res && (res.ok || res.type === 'opaque')) c.put(e.request, res.clone());
          return res;
        } catch (_) { return new Response('', { status: 504 }); }
      })
    );
    return;
  }

  /* CDN ไลบรารี — cache-first */
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached ||
          fetch(e.request).then((res) => {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
            return res;
          })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* Vite /assets/ (hash filenames) — cache-first เพราะชื่อไฟล์ไม่ซ้ำกัน */
  if (url.pathname.startsWith(BASE + 'assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached ||
          fetch(e.request).then((res) => {
            if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
            return res;
          })
      )
    );
    return;
  }

  /* same-origin อื่น — stale-while-revalidate */
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
