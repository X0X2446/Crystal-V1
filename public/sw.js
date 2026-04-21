// Scramjet v2 Service Worker
// Imports from /scramjet/ which is served by server.js from the npm dist folder.
importScripts('/scramjet/scramjet.worker.js');

const scramjet = new ScramjetServiceWorker();

// Skip waiting so the SW activates immediately on install (no page reload needed)
self.addEventListener('install', () => self.skipWaiting());

// Claim all open clients so this SW controls the page right away.
// Without this, the first proxyURL() call can fire before the SW has taken
// control and the request falls through to the server's catch-all.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let scramjet handle any request it knows about (proxied URLs)
  if (scramjet.route(event)) {
    event.respondWith(scramjet.fetch(event));
  }
});
