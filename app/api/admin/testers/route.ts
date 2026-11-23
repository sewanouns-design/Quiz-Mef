import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Liste des comptes testeurs (is_test=true) pour l'admin, avec leur profil
 * de test choisi à l'inscription et leur progression (nombre de quiz
 * soumis, non annulés) sur l'ensemble des quiz disponibles en base.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [{ data: testers, error: testersError }, { count: totalQuizCount }] = await Promise.all([
    supabase
      .from("participants")
      .select("id, name, email, whatsapp, test_profile, created_at")
      .eq("is_test", true)
      .order("created_at", { ascending: false }),
    supabase.from("daily_quizzes").select("id", { count: "exact", head: true }),
  ]);

  if (testersError) {
    return NextResponse.json({ error: testersError.message }, { status: 500 });
  }

  const testerIdsForFeedback = (testers ?? []).map((t) => t.id);
  const { data: feedback, error: feedbackError } = testerIdsForFeedback.length
    ? await supabase
        .from("suggestions")
        .select("id, message, created_at, participant_id")
        .in("participant_id", testerIdsForFeedback)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (feedbackError) {
    return NextResponse.json({ error: feedbackError.message }, { status: 500 });
  }

  const nameById = new Map((testers ?? []).map((t) => [t.id, t.name]));
  const feedbackResult = (feedback ?? []).map((f) => ({
    id: f.id,
    message: f.message,
    createdAt: f.created_at,
    testerName: nameById.get(f.participant_id ?? "") ?? "Testeur inconnu",
  }));

  const testerIds = (testers ?? []).map((t) => t.id);
  const { data: submissions, error: submissionsError } = testerIds.length
    ? await supabase
        .from("daily_submissions")
        .select("participant_id, quiz_id, score, max_score, cancelled")
        .in("participant_id", testerIds)
    : { data: [], error: null };

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const statsByParticipant = new Map<
    string,
    { completed: number; totalScore: number; totalMaxScore: number }
  >();
  for (const s of submissions ?? []) {
    if (s.cancelled || !s.participant_id) continue;
    const stat = statsByParticipant.get(s.participant_id) ?? {
      completed: 0,
      totalScore: 0,
      totalMaxScore: 0,
    };
    stat.completed += 1;
    stat.totalScore += s.score;
    stat.totalMaxScore += s.max_score;
    statsByParticipant.set(s.participant_id, stat);
  }

  const result = (testers ?? []).map((t) => {
    const stat = statsByParticipant.get(t.id);
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      whatsapp: t.whatsapp,
      testProfile: t.test_profile,
      createdAt: t.created_at,
      quizCompleted: stat?.completed ?? 0,
      totalQuizAvailable: totalQuizCount ?? 0,
      totalScore: stat?.totalScore ?? 0,
      totalMaxScore: stat?.totalMaxScore ?? 0,
    };
  });

  return NextResponse.json({ testers: result, feedback: feedbackResult });
}
