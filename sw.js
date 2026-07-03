/* Service Worker — คำขอใช้พื้นที่ป่า ขท.กระบี่ */
const CACHE = 'forest-app-v2';
const ASSETS = ['./', './index.html', './map.html', './manifest.json', './icon-192.png', './icon-512.png'];

// CDN ของหน้าแผนที่ (Leaflet / proj4 / shpjs) — cache-first เพื่อให้เปิดออฟไลน์ได้
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net'];

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

// same-origin: cache-first แล้วอัปเดตเงียบๆ / cross-origin (GAS API): ผ่านตรง ไม่ cache
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // ไลบรารีแผนที่จาก CDN: cache-first (tile ภาพแผนที่จาก google/osm ไม่เข้าเงื่อนไขนี้ ผ่านตรงตามเดิม)
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        }))
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
