import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeStreakDays } from "@/lib/streak";
import { isPassingScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/**
 * "Mes stats" : historique du participant identifié par son appareil (pas de
 * compte) — la première tentative valide de chaque quiz est officielle ; les
 * suivantes sont conservées séparément comme reprises pédagogiques.
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
    .select(
      "score, max_score, submitted_at, result_token, quiz_id, attempt_number, cancelled, quiz:daily_quizzes(title, subtitle, category)"
    )
    .eq("participant_id", participant.id)
    .order("attempt_number", { ascending: true })
    .order("submitted_at", { ascending: true });

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const rows = (submissions ?? []).filter((s) => !s.cancelled);
  const byQuiz = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.quiz_id) continue;
    const current = byQuiz.get(row.quiz_id) ?? [];
    current.push(row);
    byQuiz.set(row.quiz_id, current);
  }

  const history = Array.from(byQuiz.entries())
    .map(([quizId, quizRows]) => {
      const ordered = [...quizRows].sort(
        (a, b) => (a.attempt_number ?? 0) - (b.attempt_number ?? 0) ||
          new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      );
      const official = ordered[0];
      const quiz = official.quiz as unknown as {
        title: string;
        subtitle: string | null;
        category: "daily" | "weekly" | "quarterly";
      } | null;
      return {
        quizId,
        quizTitle: quiz?.title ?? "Quiz supprimé",
        quizSubtitle: quiz?.subtitle ?? null,
        category: quiz?.category ?? "daily",
        official: {
          score: official.score,
          maxScore: official.max_score,
          submittedAt: official.submitted_at,
          resultToken: official.result_token,
        },
        training: ordered.slice(1).reverse().map((attempt) => ({
          score: attempt.score,
          maxScore: attempt.max_score,
          attemptNumber: attempt.attempt_number,
          submittedAt: attempt.submitted_at,
          resultToken: attempt.result_token,
        })),
        latestSubmittedAt: ordered[ordered.length - 1].submitted_at,
      };
    })
    .sort((a, b) => new Date(b.latestSubmittedAt).getTime() - new Date(a.latestSubmittedAt).getTime());

  const officialRows = history.map((h) => h.official);
  const quizzesCount = history.length;
  const passedCount = officialRows.filter((s) => isPassingScore(s.score, s.maxScore)).length;
  const trainingAttemptsCount = history.reduce((sum, item) => sum + item.training.length, 0);
  const categoryCounts = history.reduce(
    (counts, item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
      return counts;
    },
    { daily: 0, weekly: 0, quarterly: 0 } as Record<"daily" | "weekly" | "quarterly", number>
  );
  const averagePercent =
    quizzesCount > 0
      ? Math.round((officialRows.reduce((sum, s) => sum + s.score / s.maxScore, 0) / quizzesCount) * 100)
      : null;
  const bestScorePercent =
    quizzesCount > 0
      ? Math.round(Math.max(...officialRows.map((s) => s.score / s.maxScore)) * 100)
      : null;
  const pedagogicalBestPercent =
    rows.length > 0 ? Math.round(Math.max(...rows.map((s) => s.score / s.max_score)) * 100) : null;
  const streakDays = computeStreakDays(officialRows.map((s) => s.submittedAt));

  return NextResponse.json({
    participant: { name: participant.name },
    quizzesCount,
    passedCount,
    passRatePercent: quizzesCount > 0 ? Math.round((passedCount / quizzesCount) * 100) : null,
    attemptsCount: rows.length,
    trainingAttemptsCount,
    categoryCounts,
    averagePercent,
    bestScorePercent,
    pedagogicalBestPercent,
    streakDays,
    history,
  });
}
