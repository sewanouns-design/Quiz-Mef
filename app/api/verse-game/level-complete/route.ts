import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/rate-limit";
import { MAX_LEVEL } from "@/lib/verse-level";

export const dynamic = "force-dynamic";

const RATE_LIMIT_ROUTE = "verse-game-level-complete";
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const POINTS_PER_CORRECT = 10;
const PASS_RATIO = 0.75;

/**
 * Enregistre la fin d'un niveau de "Trouve le verset" : ajoute les points
 * gagnés (10 par bonne réponse) au total cumulé, et débloque le niveau
 * suivant si le niveau joué est bien celui en cours (pas un niveau déjà
 * dépassé rejoué) et qu'au moins 75% des réponses sont correctes.
 * Aucune identification requise.
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
  const level = Number(body?.level);
  const score = Number(body?.score);
  const total = Number(body?.total);

  if (
    !deviceKey ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > MAX_LEVEL ||
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    total <= 0 ||
    score < 0 ||
    score > total
  ) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("verse_game_progress")
    .select("id, current_level, total_points")
    .eq("device_key", deviceKey)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const currentLevel = existing?.current_level ?? 1;
  const totalPoints = existing?.total_points ?? 0;
  const pointsEarned = score * POINTS_PER_CORRECT;
  const passed = score / total >= PASS_RATIO;
  // Ne débloque que si on joue bien le niveau en cours (pas un niveau déjà
  // dépassé, rejoué pour s'entraîner) — rejouer un niveau déjà réussi
  // rapporte quand même des points, mais ne fait pas avancer le niveau.
  const leveledUp = passed && level === currentLevel && currentLevel < MAX_LEVEL;
  const newLevel = leveledUp ? currentLevel + 1 : currentLevel;
  const newTotalPoints = totalPoints + pointsEarned;

  if (existing) {
    const { error } = await supabase
      .from("verse_game_progress")
      .update({
        current_level: newLevel,
        total_points: newTotalPoints,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("verse_game_progress").insert({
      device_key: deviceKey,
      current_level: newLevel,
      total_points: newTotalPoints,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { count: betterCount, error: rankError } = await supabase
    .from("verse_game_progress")
    .select("*", { count: "exact", head: true })
    .gt("total_points", newTotalPoints);
  if (rankError) {
    return NextResponse.json({ error: rankError.message }, { status: 500 });
  }

  return NextResponse.json({
    pointsEarned,
    totalPoints: newTotalPoints,
    currentLevel: newLevel,
    leveledUp,
    rank: (betterCount ?? 0) + 1,
  });
}
