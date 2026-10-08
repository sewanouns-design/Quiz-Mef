import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/rate-limit";
import { MAX_LEVEL } from "@/lib/verse-level";
import { getSiteSettings, getVerseGameAvailability } from "@/lib/site-settings";
import { verifyVerseGameSessionToken } from "@/lib/verse-game-session";

export const dynamic = "force-dynamic";

const RATE_LIMIT_ROUTE = "verse-game-level-complete";
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const POINTS_PER_CORRECT = 10;
const PASS_RATIO = 0.8;
const MAX_ANSWERS_PER_REQUEST = 50;

/**
 * Enregistre la fin d'un niveau de "Trouve le verset" : débloque le niveau
 * suivant si le niveau joué est bien celui en cours (pas un niveau déjà
 * dépassé rejoué) et qu'au moins 80% des réponses sont correctes
 * (PASS_RATIO), et alimente les statistiques réelles de réussite par
 * verset (bible_verse_stats) — c'est cette mesure, pas la longueur du
 * texte, qui détermine la vraie difficulté d'un verset (voir
 * recalculate_verse_levels_by_difficulty).
 *
 * Les points (10 par bonne réponse) ne sont crédités QUE lors d'un vrai
 * passage de niveau (leveledUp) : un échec (moins de 80%) ne rapporte
 * rien, et rejouer un niveau déjà réussi non plus — sinon rejouer le même
 * niveau en boucle permettrait d'accumuler des points indéfiniment sans
 * jamais progresser.
 *
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

  const settings = await getSiteSettings();
  if (!getVerseGameAvailability(settings).open) {
    return NextResponse.json({ error: "Le jeu n'est pas disponible actuellement." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const deviceKey = typeof body?.deviceKey === "string" ? body.deviceKey.trim() : "";
  const level = Number(body?.level);
  const score = Number(body?.score);
  const total = Number(body?.total);
  const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : "";
  const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];

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

  const answers: { verseId: string; correct: boolean }[] = rawAnswers
    .slice(0, MAX_ANSWERS_PER_REQUEST)
    .filter(
      (a: unknown): a is { verseId: string; correct: boolean } =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as { verseId?: unknown }).verseId === "string" &&
        typeof (a as { correct?: unknown }).correct === "boolean"
    );

  // Anti-triche : le jeton vient de /api/verse-game/questions et prouve que
  // ces questions, pour ce niveau, ont bien été chargées il y a assez
  // longtemps pour avoir pu être lues et répondues par un humain.
  const sessionCheck = verifyVerseGameSessionToken(
    sessionToken,
    level,
    answers.map((a) => a.verseId)
  );
  if (!sessionCheck.valid) {
    return NextResponse.json(
      { error: "Session de jeu invalide ou expirée — recharge la page et rejoue ce niveau." },
      { status: 400 }
    );
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
  const passed = score / total >= PASS_RATIO;
  // Ne débloque que si on joue bien le niveau en cours (pas un niveau déjà
  // dépassé, rejoué pour s'entraîner, ni un échec).
  const leveledUp = passed && level === currentLevel && currentLevel < MAX_LEVEL;
  const newLevel = leveledUp ? currentLevel + 1 : currentLevel;
  // Les points ne comptent que pour un vrai passage de niveau — jamais pour
  // un échec, ni pour rejouer (réussi ou non) un niveau déjà validé, sinon
  // il suffirait de rejouer le même niveau en boucle pour accumuler des
  // points sans jamais progresser.
  const pointsEarned = leveledUp ? score * POINTS_PER_CORRECT : 0;
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

  // Best-effort, par verset : un échec isolé ne doit jamais faire échouer
  // la requête (la progression elle-même est déjà enregistrée au-dessus).
  for (const answer of answers) {
    const { data: stat } = await supabase
      .from("bible_verse_stats")
      .select("correct_count, incorrect_count")
      .eq("verse_id", answer.verseId)
      .maybeSingle();

    await supabase.from("bible_verse_stats").upsert({
      verse_id: answer.verseId,
      correct_count: (stat?.correct_count ?? 0) + (answer.correct ? 1 : 0),
      incorrect_count: (stat?.incorrect_count ?? 0) + (answer.correct ? 0 : 1),
      updated_at: new Date().toISOString(),
    });
  }

  const { count: betterCount, error: rankError } = await supabase
    .from("verse_game_progress")
    .select("*", { count: "exact", head: true })
    .gt("total_points", newTotalPoints);
  if (rankError) {
    return NextResponse.json({ error: rankError.message }, { status: 500 });
  }
  const rank = (betterCount ?? 0) + 1;

  // Best-effort : la notification flottante est un bonus, pas un enjeu.
  // Toute partie terminée alimente le fil d'activité (pas seulement les
  // passages de niveau), pour que les autres joueurs voient les points
  // gagnés en temps réel et soient motivés à jouer davantage.
  if (pointsEarned > 0) {
    await supabase.from("verse_game_activity").insert({
      device_key: deviceKey,
      level: newLevel,
      rank,
      points_earned: pointsEarned,
      leveled_up: leveledUp,
    });
  }

  return NextResponse.json({
    pointsEarned,
    totalPoints: newTotalPoints,
    currentLevel: newLevel,
    leveledUp,
    rank,
  });
}
