import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeStreakDays } from "@/lib/streak";
import { isPassingScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/**
 * "Mes stats" : historique du participant identifié par son appareil (pas de
 * compte) — nombre de quiz passés, score moyen, série en cours, meilleur
 * score. Uniquement les vraies tentatives (annulées exclues).
 */
export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  if (!deviceKey) {
    return NextResponse.json({ error: "deviceKey requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, name")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ participant: null });
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("daily_submissions")
    .select("score, max_score, submitted_at, result_token, quiz_id, quiz:daily_quizzes(title)")
    .eq("participant_id", participant.id)
    .eq("cancelled", false)
    .order("submitted_at", { ascending: false });

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const rows = submissions ?? [];
  const history = rows.map((s) => {
    const quiz = s.quiz as unknown as { title: string } | null;
    return {
      quizId: s.quiz_id,
      quizTitle: quiz?.title ?? "Quiz supprimé",
      score: s.score,
      maxScore: s.max_score,
      submittedAt: s.submitted_at,
      resultToken: s.result_token,
    };
  });
  const quizzesCount = rows.length;
  const passedCount = rows.filter((s) => isPassingScore(s.score, s.max_score)).length;
  const averagePercent =
    quizzesCount > 0
      ? Math.round((rows.reduce((sum, s) => sum + s.score / s.max_score, 0) / quizzesCount) * 100)
      : null;
  const bestScorePercent =
    quizzesCount > 0
      ? Math.round(Math.max(...rows.map((s) => s.score / s.max_score)) * 100)
      : null;
  const streakDays = computeStreakDays(rows.map((s) => s.submitted_at));

  return NextResponse.json({
    participant: { name: participant.name },
    quizzesCount,
    passedCount,
    averagePercent,
    bestScorePercent,
    streakDays,
    history,
  });
}
