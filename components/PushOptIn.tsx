"use client";

import { useEffect, useState } from "react";
import { getStoredParticipant } from "@/lib/participant-storage";
import { requestPushSubscription } from "@/lib/push-client";

type Status = "checking" | "prompt" | "subscribed" | "unsupported" | "denied" | "error";

/**
 * Demande l'autorisation push sur l'ensemble du site, y compris avant toute
 * identification au quiz. Le choix « Plus tard » masque la fenêtre pour la
 * session courante ; elle pourra réapparaître lors d'une prochaine visite.
 */
export default function PushOptIn() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function inspect() {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (subscription) {
          setStatus("subscribed");
        } else if (Notification.permission === "granted") {
          const participant = getStoredParticipant();
          const result = await requestPushSubscription(participant?.deviceKey);
          if (cancelled) return;
          setStatus(result === "subscribed" ? "subscribed" : result === "unsupported" ? "unsupported" : "error");
        }
        else if (window.sessionStorage.getItem("mef_push_prompt_dismissed") === "1") {
          setStatus("checking");
        } else {
          setStatus("prompt");
        }
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }

    inspect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enableNotifications() {
    setBusy(true);
    setStatus("checking");
    const participant = getStoredParticipant();
    const result = await requestPushSubscription(participant?.deviceKey);
    if (result === "subscribed") setStatus("subscribed");
    else if (result === "denied") setStatus("denied");
    else if (result === "unsupported") setStatus("unsupported");
    else setStatus("error");
    setBusy(false);
  }

  function dismissForSession() {
    try {
      window.sessionStorage.setItem("mef_push_prompt_dismissed", "1");
    } catch {
      // Le navigateur peut désactiver le stockage ; le masquage local reste suffisant.
    }
    setStatus("checking");
  }

  if (status === "subscribed" || status === "checking" || status === "unsupported") return null;

  if (status === "denied") {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-xl">
        <p className="font-semibold text-navy">Notifications bloquées</p>
        <p className="mt-1 text-xs text-gray-500">
          Active les notifications de ce site dans les réglages de ton navigateur pour recevoir les nouveaux quiz.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-4 text-sm shadow-xl">
        <p className="font-semibold text-navy">Impossible d’activer les notifications</p>
        <p className="mt-1 text-xs text-gray-500">Réessaie depuis ce site dans quelques instants.</p>
        <button type="button" onClick={() => setStatus("prompt")} className="btn-secondary mt-3 px-4 py-2 text-sm">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-opt-in-title"
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
      >
        <div className="mb-3 text-3xl" aria-hidden="true">
          🔔
        </div>
        <h2 id="push-opt-in-title" className="text-xl font-bold text-navy">
          Recevoir les nouveautés du site ?
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Active les notifications pour être informé lorsqu’un nouveau quiz ou une nouveauté est publiée sur Quiz Biblique.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={enableNotifications}
            disabled={busy}
            className="btn-primary w-full px-4 py-3 sm:w-auto"
          >
            {busy ? "Activation..." : "Activer les notifications"}
          </button>
          <button
            type="button"
            onClick={dismissForSession}
            disabled={busy}
            className="btn-secondary w-full px-4 py-3 sm:w-auto"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
