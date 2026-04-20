importScripts('/scramjet/scramjet.worker.js');

const scramjet = new ScramjetServiceWorker();

self.addEventListener('fetch', (event) => {
  event.respondWith(scramjet.fetch(event));
});
