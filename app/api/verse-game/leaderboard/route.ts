import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatLeaderboardName } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 20;

/**
 * Classement PUBLIC de "Trouve le verset". Comme pour le quiz, un nom n'est
 * affiché que pour les appareils liés à un participant ayant activé
 * "Afficher mon prénom dans le classement" — les scores anonymes comptent
 * dans le classement (le rang renvoyé est réel) mais n'apparaissent jamais
 * nommément dans la liste publique.
 */
export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");

  const supabase = getSupabaseAdmin();

  const { data: scores, error: scoresError } = await supabase
    .from("verse_game_scores")
    .select("device_key, best_score, total_questions")
    .order("best_score", { ascending: false });
  if (scoresError) {
    return NextResponse.json({ error: scoresError.message }, { status: 500 });
  }

  const ranked = scores ?? [];
  const deviceKeys = ranked.map((s) => s.device_key);

  const { data: participants, error: participantsError } =
    deviceKeys.length > 0
      ? await supabase
          .from("participants")
          .select("device_key, name, show_in_leaderboard")
          .in("device_key", deviceKeys)
      : { data: [], error: null };
  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  const participantByDevice = new Map(
    (participants ?? []).map((p) => [p.device_key, p])
  );

  const entries = ranked
    .filter((s) => participantByDevice.get(s.device_key)?.show_in_leaderboard)
    .slice(0, MAX_ENTRIES)
    .map((s) => ({
      displayName: formatLeaderboardName(participantByDevice.get(s.device_key)!.name),
      score: s.best_score,
      total: s.total_questions,
    }));

  let myRank: number | null = null;
  let myScore: number | null = null;
  let myTotal: number | null = null;
  if (deviceKey) {
    const idx = ranked.findIndex((s) => s.device_key === deviceKey);
    if (idx !== -1) {
      myRank = idx + 1;
      myScore = ranked[idx].best_score;
      myTotal = ranked[idx].total_questions;
    }
  }

  return NextResponse.json({
    entries,
    totalPlayers: ranked.length,
    myRank,
    myScore,
    myTotal,
  });
}
