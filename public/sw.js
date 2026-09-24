// Service worker minimal : uniquement pour satisfaire les critères
// d'installabilité PWA. Ne met RIEN en cache — les réponses de l'API et
// des pages sont toujours dynamiques (score, quiz du jour, résultats en
// direct), les mettre en cache re-créerait le bug de données obsolètes déjà
// rencontré une fois sur ce projet avec le cache de données de Next.js.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
