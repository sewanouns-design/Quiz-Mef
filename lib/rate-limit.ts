import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabase";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/** Retourne true si l'IP a dépassé le nombre d'échecs de connexion autorisés récemment. */
export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("created_at", since);

  return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("login_attempts").insert({ ip, success });
}

export const LOGIN_RATE_LIMIT_WINDOW_MINUTES = WINDOW_MINUTES;

/**
 * Limitation de débit générique par IP + route, pour les endpoints publics
 * d'écriture (inscription, soumission de quiz, question sur la leçon).
 * Empêche le spam et l'utilisation du site comme relais d'envoi d'emails
 * non sollicités (le formulaire d'inscription accepte n'importe quel email,
 * et la soumission d'un quiz déclenche l'envoi d'un email de résultats).
 */
export async function isRateLimited(
  ip: string,
  route: string,
  maxEvents: number,
  windowMinutes: number
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("route", route)
    .gte("created_at", since);

  return (count ?? 0) >= maxEvents;
}

export async function recordRateLimitEvent(ip: string, route: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("rate_limit_events").insert({ ip, route });
}
