// Service worker — offline support (bump CACHE on every deploy)
var CACHE = 'mps-v2';
var CORE = [
  './',
  'index.html',
  'manifest.json',
  'ads.js',
  'utils.js',
  'data.js',
  'MonsterRenderer.js',
  'ui/Button.js',
  'ui/Toast.js',
  'ui/MonsterPanel.js',
  'scenes/Boot.js',
  'scenes/Hub.js',
  'scenes/Merchant.js',
  'scenes/HatchScene.js',
  'scenes/BreedingLab.js',
  'scenes/HabitatRoom.js',
  'game.js',
  'icon-192.png',
  'icon-512.png',
  'phaser.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.all(CORE.map(function(f) { return c.add(f).catch(function() {}); }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (/google|doubleclick|googlesyndication|adservice/.test(url.hostname)) return;
  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(req).then(function(hit) {
        var net = fetch(req).then(function(res) {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(function() { return hit; });
        return hit || net;
      });
    })
  );
});
