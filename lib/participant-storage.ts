"use client";

const STORAGE_KEY = "mef_participant";

export interface StoredParticipant {
  deviceKey: string;
  name: string;
  address: string;
  email: string;
  whatsapp: string;
  showInLeaderboard?: boolean;
}

export function getStoredParticipant(): StoredParticipant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredParticipant;
  } catch {
    return null;
  }
}

export function saveStoredParticipant(data: StoredParticipant): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Retourne le device_key existant, ou en génère un nouveau et le persiste. */
export function getOrCreateDeviceKey(): string {
  const existing = getStoredParticipant();
  if (existing?.deviceKey) return existing.deviceKey;

  return crypto.randomUUID();
}

const ANON_DEVICE_KEY_STORAGE_KEY = "mef_anon_device_key";

/**
 * Identifiant d'appareil pour les fonctionnalités qui ne nécessitent aucune
 * identification (ex : "Trouve le verset"). Réutilise le device_key du
 * participant s'il existe déjà (pour relier au même classement opt-in),
 * sinon génère et persiste un identifiant anonyme dédié — contrairement à
 * getOrCreateDeviceKey() ci-dessus, qui ne persiste qu'après identification
 * complète, celui-ci est utilisable immédiatement sans jamais demander de
 * nom/email.
 */
export function getOrCreateAnonymousDeviceKey(): string {
  const stored = getStoredParticipant();
  if (stored?.deviceKey) return stored.deviceKey;

  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const existing = window.localStorage.getItem(ANON_DEVICE_KEY_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(ANON_DEVICE_KEY_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Efface tout le cache local de progression d'un quiz (écran de départ
 * franchi, date limite du chrono, index de la question en cours en mode
 * séquentiel) pour cet appareil. Utilisé après une réinitialisation admin
 * (soumission supprimée) pour que le participant reparte de l'écran de
 * départ sur CE MÊME appareil, pas seulement sur un autre.
 */
export function clearQuizProgress(quizId: string, deviceKey: string): void {
  if (typeof window === "undefined") return;
  const keys = [
    `quiz_started_${quizId}_${deviceKey}`,
    `quiz_deadline_${quizId}_${deviceKey}`,
    `quiz_seq_index_${quizId}_${deviceKey}`,
  ];
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // stockage indisponible, tant pis
    }
  }
}
