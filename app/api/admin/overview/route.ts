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
  let parishQuery = supabase.from("participants").select("parish");
  let recentSubmissionsQuery = supabase
    .from("daily_submissions")
    .select(
      "score, max_score, cancelled, submitted_at, participant:participants(name, parish), quiz:daily_quizzes(title)"
    );

  if (fromTs) {
    participantsQuery = participantsQuery.gte("created_at", fromTs);
    quizzesQuery = quizzesQuery.gte("created_at", fromTs);
    lessonQuestionsQuery = lessonQuestionsQuery.gte("created_at", fromTs);
    submissionsQuery = submissionsQuery.gte("submitted_at", fromTs);
    parishQuery = parishQuery.gte("created_at", fromTs);
    recentSubmissionsQuery = recentSubmissionsQuery.gte("submitted_at", fromTs);
  }
  if (toTs) {
    participantsQuery = participantsQuery.lte("created_at", toTs);
    quizzesQuery = quizzesQuery.lte("created_at", toTs);
    lessonQuestionsQuery = lessonQuestionsQuery.lte("created_at", toTs);
    submissionsQuery = submissionsQuery.lte("submitted_at", toTs);
    parishQuery = parishQuery.lte("created_at", toTs);
    recentSubmissionsQuery = recentSubmissionsQuery.lte("submitted_at", toTs);
  }

  const [
    participantsCount,
    quizzesCount,
    lessonQuestionsCount,
    submissionsRows,
    parishRows,
    activeQuiz,
    recentSubmissions,
  ] = await Promise.all([
    participantsQuery,
    quizzesQuery,
    lessonQuestionsQuery,
    submissionsQuery,
    parishQuery,
    supabase.from("daily_quizzes").select("title").eq("is_active", true).maybeSingle(),
    recentSubmissionsQuery.order("submitted_at", { ascending: false }).limit(8),
  ]);

  const errors = [
    participantsCount.error,
    quizzesCount.error,
    lessonQuestionsCount.error,
    submissionsRows.error,
    parishRows.error,
    activeQuiz.error,
    recentSubmissions.error,
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

  const distinctParishes = new Set(
    (parishRows.data ?? [])
      .map((p) => (p.parish ?? "").trim().toLowerCase())
      .filter((p) => p.length > 0)
  );

  return NextResponse.json({
    period: { from, to },
    participantsCount: participantsCount.count ?? 0,
    quizzesCount: quizzesCount.count ?? 0,
    submissionsCount: submissions.length,
    cancelledCount,
    passedCount,
    averageScorePercent,
    lessonQuestionsCount: lessonQuestionsCount.count ?? 0,
    parishesCount: distinctParishes.size,
    activeQuizTitle: activeQuiz.data?.title ?? null,
    recentSubmissions: recentSubmissions.data ?? [],
  });
}
