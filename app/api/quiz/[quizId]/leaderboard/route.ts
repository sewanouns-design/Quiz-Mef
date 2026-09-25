import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatLeaderboardName } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

/**
 * Classement PUBLIC d'un quiz : uniquement les participants ayant activé
 * l'option "Afficher mon prénom dans le classement" à l'identification
 * (opt-in explicite, jamais par défaut). Prénom + initiale seulement, jamais
 * le nom complet ni l'adresse/email/whatsapp — voir formatLeaderboardName.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const supabase = getSupabaseAdmin();

  const { data: submissions, error } = await supabase
    .from("daily_submissions")
    .select("score, max_score, participant:participants!inner(name, show_in_leaderboard)")
    .eq("quiz_id", params.quizId)
    .eq("cancelled", false)
    .eq("participant.show_in_leaderboard", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Un participant peut avoir plusieurs tentatives : on ne garde que son
  // meilleur score pour ce quiz, pas une ligne par tentative.
  const bestByName = new Map<string, { name: string; score: number; maxScore: number }>();
  for (const s of submissions ?? []) {
    const participant = s.participant as unknown as { name: string; show_in_leaderboard: boolean } | null;
    if (!participant) continue;
    const key = participant.name.trim().toLowerCase();
    const existing = bestByName.get(key);
    if (!existing || s.score > existing.score) {
      bestByName.set(key, { name: participant.name, score: s.score, maxScore: s.max_score });
    }
  }

  const entries = Array.from(bestByName.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((e) => ({
      displayName: formatLeaderboardName(e.name),
      score: e.score,
      maxScore: e.maxScore,
    }));

  return NextResponse.json({ entries });
}
