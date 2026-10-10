"use client";

import { useEffect, useState } from "react";

type Status = "unknown" | "unsupported" | "subscribed" | "unsubscribed" | "denied";

/**
 * Statut des rappels/notifications push : l'abonnement lui-même est demandé
 * automatiquement dès l'identification (voir lib/push-client.ts, appelé
 * depuis app/quiz/page.tsx) — ce composant ne fait qu'en refléter l'état,
 * sans bouton d'action.
 */
export default function PushOptIn() {
  const [status, setStatus] = useState<Status>("unknown");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "unsubscribed"))
      .catch(() => setStatus("unsupported"));
  }, []);

  if (status === "subscribed") {
    return <p className="text-sm font-semibold text-green-600">🔔 Notifications activées</p>;
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-gray-400">
        🔕 Notifications bloquées par ton navigateur — active-les dans les réglages du site pour
        recevoir les rappels et les nouveautés.
      </p>
    );
  }

  return null;
}
