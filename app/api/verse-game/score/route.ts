import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT_ROUTE = "verse-game-score";
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * Enregistre le score d'une partie de "Trouve le verset" (meilleur score
 * conservé par appareil) et renvoie le rang obtenu. Aucune identification
 * requise : device_key peut être anonyme (voir getOrCreateAnonymousDeviceKey).
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (await checkAndRecordRateLimit(ip, RATE_LIMIT_ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const deviceKey = typeof body?.deviceKey === "string" ? body.deviceKey.trim() : "";
  const score = Number(body?.score);
  const total = Number(body?.total);

  if (!deviceKey || !Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0 || score > total) {
    return NextResponse.json({ error: "Données de score invalides." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("verse_game_scores")
    .select("id, best_score, games_played")
    .eq("device_key", deviceKey)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let bestScore = score;
  if (existing) {
    bestScore = Math.max(existing.best_score, score);
    const { error } = await supabase
      .from("verse_game_scores")
      .update({
        best_score: bestScore,
        total_questions: total,
        games_played: existing.games_played + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("verse_game_scores").insert({
      device_key: deviceKey,
      best_score: score,
      total_questions: total,
      games_played: 1,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { count: betterCount, error: rankError } = await supabase
    .from("verse_game_scores")
    .select("*", { count: "exact", head: true })
    .gt("best_score", bestScore);
  if (rankError) {
    return NextResponse.json({ error: rankError.message }, { status: 500 });
  }

  return NextResponse.json({
    bestScore,
    isNewBest: score >= bestScore && (!existing || score > existing.best_score),
    rank: (betterCount ?? 0) + 1,
  });
}
