importScripts('/scramjet/scramjet.worker.js');

const scramjet = new ScramjetServiceWorker();

// Immediately claim all clients so the SW controls the page right away
// without requiring a reload. This prevents the race where the first
// proxyURL() call fires before the SW has taken control.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

// Handle explicit claim request from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLAIM') {
    self.clients.claim();
  }
});

self.addEventListener('fetch', (event) => {
  if (scramjet.route(event)) {
    event.respondWith(scramjet.fetch(event));
  }
});
