import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";
import { isPassingScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/** Convertit une date "YYYY-MM-DD" en horodatage début/fin de journée (UTC). */
function toRangeTimestamps(from: string | null, to: string | null) {
  return {
    fromTs: from ? `${from}T00:00:00.000Z` : null,
    toTs: to ? `${to}T23:59:59.999Z` : null,
  };
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const { fromTs, toTs } = toRangeTimestamps(from, to);

  const supabase = getSupabaseAdmin();

  let participantsQuery = supabase
    .from("participants")
    .select("*", { count: "exact", head: true });
  let quizzesQuery = supabase.from("daily_quizzes").select("*", { count: "exact", head: true });
  let lessonQuestionsQuery = supabase
    .from("lesson_questions")
    .select("*", { count: "exact", head: true });
  let submissionsQuery = supabase
    .from("daily_submissions")
    .select("score, max_score, cancelled, submitted_at");
  let recentSubmissionsQuery = supabase
    .from("daily_submissions")
    .select(
      "score, max_score, cancelled, submitted_at, participant:participants(name, address), quiz:daily_quizzes(title)"
    );
  let recentActivityQuery = supabase
    .from("admin_activity_log")
    .select("action, summary, created_at");

  if (fromTs) {
    participantsQuery = participantsQuery.gte("created_at", fromTs);
    quizzesQuery = quizzesQuery.gte("created_at", fromTs);
    lessonQuestionsQuery = lessonQuestionsQuery.gte("created_at", fromTs);
    submissionsQuery = submissionsQuery.gte("submitted_at", fromTs);
    recentSubmissionsQuery = recentSubmissionsQuery.gte("submitted_at", fromTs);
    recentActivityQuery = recentActivityQuery.gte("created_at", fromTs);
  }
  if (toTs) {
    participantsQuery = participantsQuery.lte("created_at", toTs);
    quizzesQuery = quizzesQuery.lte("created_at", toTs);
    lessonQuestionsQuery = lessonQuestionsQuery.lte("created_at", toTs);
    submissionsQuery = submissionsQuery.lte("submitted_at", toTs);
    recentSubmissionsQuery = recentSubmissionsQuery.lte("submitted_at", toTs);
    recentActivityQuery = recentActivityQuery.lte("created_at", toTs);
  }

  const [
    participantsCount,
    quizzesCount,
    lessonQuestionsCount,
    submissionsRows,
    activeQuiz,
    recentSubmissions,
    recentActivity,
  ] = await Promise.all([
    participantsQuery,
    quizzesQuery,
    lessonQuestionsQuery,
    submissionsQuery,
    supabase.from("daily_quizzes").select("title").eq("is_active", true).maybeSingle(),
    recentSubmissionsQuery.order("submitted_at", { ascending: false }).limit(15),
    recentActivityQuery.order("created_at", { ascending: false }).limit(15),
  ]);

  const errors = [
    participantsCount.error,
    quizzesCount.error,
    lessonQuestionsCount.error,
    submissionsRows.error,
    activeQuiz.error,
    recentSubmissions.error,
    recentActivity.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0]!.message }, { status: 500 });
  }

  const submissions = submissionsRows.data ?? [];
  const cancelledCount = submissions.filter((s) => s.cancelled).length;
  const gradedSubmissions = submissions.filter((s) => !s.cancelled && s.max_score > 0);
  const passedCount = gradedSubmissions.filter((s) => isPassingScore(s.score, s.max_score)).length;
  const averageScorePercent =
    gradedSubmissions.length > 0
      ? Math.round(
          (gradedSubmissions.reduce((sum, s) => sum + s.score / s.max_score, 0) /
            gradedSubmissions.length) *
            100
        )
      : null;

  // Timeline unifiée : soumissions des participants + actions du super-admin
  // (suppression, fusion, quiz créé/modifié/activé...), classées par type
  // pour que l'admin puisse filtrer entre "ce que font les participants" et
  // "ce que je fais moi-même" tout en gardant une seule chronologie.
  const activity = [
    ...(recentSubmissions.data ?? []).map((s) => ({
      type: "submission" as const,
      timestamp: s.submitted_at,
      score: s.score,
      maxScore: s.max_score,
      cancelled: s.cancelled,
      participant: s.participant,
      quiz: s.quiz,
    })),
    ...(recentActivity.data ?? []).map((a) => ({
      type: "admin" as const,
      timestamp: a.created_at,
      action: a.action,
      summary: a.summary,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  return NextResponse.json({
    period: { from, to },
    participantsCount: participantsCount.count ?? 0,
    quizzesCount: quizzesCount.count ?? 0,
    submissionsCount: submissions.length,
    cancelledCount,
    passedCount,
    averageScorePercent,
    lessonQuestionsCount: lessonQuestionsCount.count ?? 0,
    activeQuizTitle: activeQuiz.data?.title ?? null,
    activity,
  });
}
