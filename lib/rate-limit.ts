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
