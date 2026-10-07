// Service worker: เล่นออฟไลน์ได้หลังเปิดครั้งแรก
// เปลี่ยนเลข CACHE ทุกครั้งที่อัปเดตไฟล์เกม เพื่อให้ผู้เล่นได้เวอร์ชันใหม่
var CACHE = 'cosmic-merge-v1';
var CORE = ['./', 'index.html', 'game.js', 'ads.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'phaser.min.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // ใส่ทีละไฟล์ ไฟล์ไหนไม่มี (เช่น phaser.min.js) ก็ข้ามได้
      return Promise.all(CORE.map(function (f) { return c.add(f).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // ไม่แตะโฆษณา
  if (/google|doubleclick|googlesyndication|adservice/.test(url.hostname)) return;

  // stale-while-revalidate: ตอบจากแคชทันที แล้วอัปเดตเบื้องหลัง
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});
