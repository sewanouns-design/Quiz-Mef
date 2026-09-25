"use client";

import { useEffect, useState } from "react";
import { getStoredParticipant } from "@/lib/participant-storage";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "unknown" | "unsupported" | "subscribed" | "unsubscribed" | "denied";

/**
 * Rappel quotidien du quiz par notification push (opt-in) : moins de
 * friction qu'un email pour ramener quelqu'un le lendemain. Nécessite
 * d'être déjà identifié (participant enregistré) — c'est à ce compte que
 * l'abonnement est rattaché côté serveur pour l'envoi.
 */
export default function PushOptIn() {
  const [status, setStatus] = useState<Status>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSubscribe() {
    const participant = getStoredParticipant();
    if (!participant?.deviceKey) return;

    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Notifications indisponibles pour le moment.");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          deviceKey: participant.deviceKey,
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'activation des rappels.");
      }

      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported" || status === "unknown") return null;

  if (status === "denied") {
    return (
      <p className="text-xs text-gray-400">
        🔕 Notifications bloquées par ton navigateur — active-les dans les réglages du site pour
        recevoir un rappel quotidien.
      </p>
    );
  }

  if (status === "subscribed") {
    return <p className="text-sm font-semibold text-green-600">🔔 Rappels quotidiens activés</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={busy}
        className="text-sm font-semibold text-navy hover:underline disabled:opacity-50"
      >
        🔔 {busy ? "Activation..." : "Activer les rappels quotidiens"}
      </button>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
