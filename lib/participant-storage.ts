"use client";

const STORAGE_KEY = "mef_participant";

export interface StoredParticipant {
  deviceKey: string;
  name: string;
  address: string;
  email: string;
  whatsapp: string;
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
