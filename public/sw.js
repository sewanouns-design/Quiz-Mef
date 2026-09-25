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

// Rappel quotidien du quiz (opt-in, voir lib/push.ts et components/PushOptIn.tsx).
self.addEventListener("push", (event) => {
  let data = { title: "Quiz Biblique", body: "Une nouvelle question t'attend.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload non-JSON, on garde les valeurs par défaut
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/pwa-192.png",
      badge: "/icons/pwa-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
