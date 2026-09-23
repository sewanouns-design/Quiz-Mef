import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "mef_admin_session";
const SESSION_VALUE = "admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 jours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET doit être défini dans les variables d'environnement.");
  }
  return secret;
}

function sign(value: string): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(value);
  return hmac.digest("hex");
}

/** Construit la valeur de cookie signée : "<valeur>.<signature>". */
export function createSignedSessionValue(): string {
  const signature = sign(SESSION_VALUE);
  return `${SESSION_VALUE}.${signature}`;
}

export function isValidSessionValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature) return false;
  if (value !== SESSION_VALUE) return false;

  const expected = sign(value);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/** À utiliser dans les Server Components / route handlers ayant accès à next/headers. */
export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies();
  const cookie = cookieStore.get(ADMIN_COOKIE_NAME);
  return isValidSessionValue(cookie?.value);
}

/** À utiliser dans les route handlers (app/api/**) à partir de la NextRequest. */
export function isAdminRequestAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME);
  return isValidSessionValue(cookie?.value);
}

export const ADMIN_COOKIE_MAX_AGE = MAX_AGE_SECONDS;

/**
 * Compare deux chaînes en temps constant (résistant aux attaques temporelles),
 * en passant par un hash pour neutraliser toute différence de longueur.
 */
export function constantTimeStringEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Défense en profondeur contre le CSRF : vérifie que l'en-tête Origin (envoyé
 * par les navigateurs modernes sur les requêtes qui changent l'état) correspond
 * bien à l'hôte de la requête. Absent d'en-tête Origin, on laisse passer : le
 * cookie SameSite=lax reste la protection principale.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
