"use client";

import { useEffect } from "react";
import { getStoredParticipant } from "@/lib/participant-storage";
import { requestPushSubscription } from "@/lib/push-client";

/**
 * Couvre les anciens participants (déjà identifiés avant l'ajout des
 * notifications push) : contrairement à la demande faite juste après
 * identification sur /quiz, celle-ci s'exécute sur N'IMPORTE QUELLE page
 * dès qu'un appareil déjà reconnu est détecté. Elle resynchronise uniquement
 * une permission déjà accordée ; la demande native est faite par le pop-up
 * PushOptIn après un clic utilisateur.
 */
export default function PushAutoSubscribe() {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const participant = getStoredParticipant();
    if (!participant?.deviceKey) return;

    requestPushSubscription(participant.deviceKey).catch(() => {});
  }, []);

  return null;
}
