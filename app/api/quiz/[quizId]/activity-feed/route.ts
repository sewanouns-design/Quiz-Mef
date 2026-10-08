import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatLeaderboardName } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 20;

/**
 * Fil d'activité PUBLIC du jour pour un quiz (bandeau défilant de la page
 * d'accueil) : qui vient de le passer, et il y a combien de temps. Prénom +
 * initiale seulement (jamais le nom complet), toujours affiché.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const supabase = getSupabaseAdmin();

  const startOfTodayUTC = new Date();
  startOfTodayUTC.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("daily_submissions")
    .select("submitted_at, participant:participants!inner(name)")
    .eq("quiz_id", params.quizId)
    .eq("cancelled", false)
    .gte("submitted_at", startOfTodayUTC.toISOString())
    .order("submitted_at", { ascending: false })
    .limit(MAX_ENTRIES);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = (data ?? []).map((s) => {
    const participant = s.participant as unknown as { name: string } | null;
    return {
      displayName: participant ? formatLeaderboardName(participant.name) : "Quelqu'un",
      submittedAt: s.submitted_at,
    };
  });

  return NextResponse.json({ entries });
}
