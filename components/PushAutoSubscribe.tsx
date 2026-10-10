"use client";

import { useEffect } from "react";
import { getStoredParticipant } from "@/lib/participant-storage";
import { requestPushSubscription } from "@/lib/push-client";

/**
 * Couvre les anciens participants (déjà identifiés avant l'ajout des
 * notifications push) : contrairement à la demande faite juste après
 * l'identification sur /quiz, celle-ci s'exécute sur N'IMPORTE QUELLE page
 * dès qu'un appareil déjà reconnu est détecté, sans attendre qu'il
 * re-remplisse le formulaire. Ne redemande jamais si déjà autorisé/refusé
 * (Notification.permission !== "default").
 */
export default function PushAutoSubscribe() {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;

    const participant = getStoredParticipant();
    if (!participant?.deviceKey) return;

    requestPushSubscription(participant.deviceKey).catch(() => {});
  }, []);

  return null;
}
