import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";
import { computeQuarterlyRanking } from "@/lib/quarterly-ranking";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: competition, error } = await supabase
    .from("quarterly_competitions")
    .select("id, title, period_start, period_end, final_quiz_id, winner_count, created_at, updated_at, final_quiz:daily_quizzes(id, title, category)")
    .eq("id", params.competitionId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!competition) return NextResponse.json({ error: "Compétition trimestrielle introuvable." }, { status: 404 });

  try {
    const result = await computeQuarterlyRanking(competition);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Impossible de calculer le classement." },
      { status: 500 }
    );
  }
}
