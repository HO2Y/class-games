const CACHE_NAME = 'arcade-trio-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/snake.html',
  '/pong.html',
  '/bullet.html',
  '/styles.css',
  '/manifest.json',
  '/src/pwa.js',
  '/src/snake-game.js',
  '/src/snake-logic.js',
  '/src/highscore.js',
  '/src/pong-game.js',
  '/src/pong-logic.js',
  '/src/bullet-game.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
