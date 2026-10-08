import { createHash, createHmac, timingSafeEqual } from "crypto";

// Anti-triche pour "Trouve le verset" : /api/verse-game/questions émet un
// jeton signé (niveau + empreinte des versets servis + horodatage), que le
// client doit renvoyer tel quel à /api/verse-game/level-complete. Ça empêche
// trois choses sans base de données ni session serveur : valider un niveau
// sans jamais avoir chargé ses questions, valider un niveau différent de
// celui réellement chargé, et valider en un temps trop court pour avoir pu
// lire/répondre (script automatisé).
// Volontairement bas : pour les niveaux faciles (versets très connus,
// très courts), un joueur qui les reconnaît au premier coup d'œil peut
// légitimement répondre à une question toutes les 400-600ms. Le but n'est
// que de bloquer une validation instantanée (script), pas de pénaliser une
// personne rapide — un seuil trop strict provoquait des échecs silencieux
// de progression bien réelle.
const MIN_MS_PER_QUESTION = 350;
const MAX_TOKEN_AGE_MS = 20 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET doit être défini dans les variables d'environnement.");
  }
  return secret;
}

function hashVerseIds(verseIds: string[]): string {
  return createHash("sha256").update([...verseIds].sort().join(",")).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createVerseGameSessionToken(level: number, verseIds: string[]): string {
  const issuedAt = Date.now();
  const payload = `${level}.${issuedAt}.${hashVerseIds(verseIds)}`;
  return `${payload}.${sign(payload)}`;
}

export interface VerseGameSessionCheck {
  valid: boolean;
  reason?: "format" | "signature" | "level_mismatch" | "verses_mismatch" | "too_fast" | "expired";
}

export function verifyVerseGameSessionToken(
  token: string,
  expectedLevel: number,
  verseIds: string[]
): VerseGameSessionCheck {
  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false, reason: "format" };
  const [levelStr, issuedAtStr, verseHash, signature] = parts;
  const payload = `${levelStr}.${issuedAtStr}.${verseHash}`;

  const expectedBuf = Buffer.from(sign(payload), "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: "signature" };
  }

  const level = Number(levelStr);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(level) || !Number.isFinite(issuedAt)) return { valid: false, reason: "format" };
  if (level !== expectedLevel) return { valid: false, reason: "level_mismatch" };
  if (hashVerseIds(verseIds) !== verseHash) return { valid: false, reason: "verses_mismatch" };

  const elapsed = Date.now() - issuedAt;
  if (elapsed > MAX_TOKEN_AGE_MS) return { valid: false, reason: "expired" };
  if (elapsed < verseIds.length * MIN_MS_PER_QUESTION) return { valid: false, reason: "too_fast" };

  return { valid: true };
}
