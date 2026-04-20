importScripts('/scramjet/scramjet.worker.js');

const scramjet = new ScramjetServiceWorker();

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/scramjet/')) {
    event.respondWith(scramjet.fetch(event));
  }
});
