import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";
import { isPassingScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [
    participantsCount,
    quizzesCount,
    lessonQuestionsCount,
    submissionsRows,
    parishRows,
    activeQuiz,
    recentSubmissions,
  ] = await Promise.all([
    supabase.from("participants").select("*", { count: "exact", head: true }),
    supabase.from("daily_quizzes").select("*", { count: "exact", head: true }),
    supabase.from("lesson_questions").select("*", { count: "exact", head: true }),
    supabase.from("daily_submissions").select("score, max_score, cancelled"),
    supabase.from("participants").select("parish"),
    supabase.from("daily_quizzes").select("title").eq("is_active", true).maybeSingle(),
    supabase
      .from("daily_submissions")
      .select(
        "score, max_score, cancelled, submitted_at, participant:participants(name, parish), quiz:daily_quizzes(title)"
      )
      .order("submitted_at", { ascending: false })
      .limit(6),
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
