/* Service Worker — คำขอใช้พื้นที่ป่า ขท.กระบี่ */
const CACHE = 'forest-app-v15';
const ASSETS = ['./', './index.html', './map.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// CDN ของหน้าแผนที่ (Leaflet / proj4 / shpjs) — cache-first เพื่อให้เปิดออฟไลน์ได้
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net'];

// tile แผนที่พื้นหลัง — cache-first เก็บถาวรเพื่อใช้ออฟไลน์ (แคชแยกไม่ถูกล้างตอนอัปเวอร์ชัน)
const TILE_HOSTS = ['mt1.google.com', 'tile.openstreetmap.org'];
const TILE_CACHE = 'tiles-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // cache:'reload' = ข้าม HTTP cache ดึงไฟล์สดจากเซิร์ฟเวอร์เสมอ ป้องกันได้ไฟล์เก่าตอนอัปเดตเวอร์ชัน
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // tile แผนที่: cache-first → ออฟไลน์ใช้แผ่นที่เคยโหลด/ดาวน์โหลดไว้
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res && (res.ok || res.type === 'opaque')) c.put(e.request, res.clone());
          return res;
        } catch (_) {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }
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
  // same-origin: cache-first แล้วอัปเดตเงียบๆ (บังคับ revalidate กับเซิร์ฟเวอร์ ไม่พึ่ง HTTP cache)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request, { cache: 'no-cache' })
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
