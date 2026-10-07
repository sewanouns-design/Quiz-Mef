import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Sauvegarde exportée en JSON lisible (indenté, une clé par table, jamais
 * compacté) pour pouvoir être relue par un humain et réimportée sans erreur
 * via /api/admin/backup/restore.
 *
 * Tables volontairement exclues : participant_login_tokens, login_attempts,
 * rate_limit_events, reengagement_reminders, push_subscriptions — purement
 * opérationnelles/éphémères (jetons, anti-spam, abonnements liés à un
 * appareil précis), sans valeur à restaurer après un incident.
 *
 * Sans from/to : sauvegarde complète, du tout premier enregistrement au plus
 * récent — c'est elle qui sert de point de restauration fiable.
 * Avec from/to : export de consultation pour une période donnée (les
 * tables de référence — quiz, questions, paramètres — restent complètes
 * pour garder le contexte ; seules les données datées sont filtrées). Cet
 * export partiel n'est pas garanti ré-importable sans perte de contexte :
 * il est pensé pour la consultation, pas pour servir de sauvegarde de
 * secours.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const isPeriodExport = Boolean(from || to);

  const supabase = getSupabaseAdmin();

  function applyRange<T extends { gte: (col: string, v: string) => T; lte: (col: string, v: string) => T }>(
    query: T,
    column: string
  ): T {
    let q = query;
    if (from) q = q.gte(column, from);
    if (to) q = q.lte(column, to);
    return q;
  }

  const { data: siteSettings, error: siteSettingsError } = await supabase
    .from("site_settings")
    .select("*");
  if (siteSettingsError) {
    return NextResponse.json({ error: siteSettingsError.message }, { status: 500 });
  }

  const { data: dailyQuizzes, error: dailyQuizzesError } = await supabase
    .from("daily_quizzes")
    .select("*")
    .order("created_at", { ascending: true });
  if (dailyQuizzesError) {
    return NextResponse.json({ error: dailyQuizzesError.message }, { status: 500 });
  }

  const { data: dailyQuestions, error: dailyQuestionsError } = await supabase
    .from("daily_questions")
    .select("*")
    .order("position", { ascending: true });
  if (dailyQuestionsError) {
    return NextResponse.json({ error: dailyQuestionsError.message }, { status: 500 });
  }

  let participantsQuery = supabase.from("participants").select("*");
  participantsQuery = applyRange(participantsQuery, "created_at");
  const { data: participants, error: participantsError } = await participantsQuery.order(
    "created_at",
    { ascending: true }
  );
  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  let submissionsQuery = supabase.from("daily_submissions").select("*");
  submissionsQuery = applyRange(submissionsQuery, "submitted_at");
  const { data: dailySubmissions, error: submissionsError } = await submissionsQuery.order(
    "submitted_at",
    { ascending: true }
  );
  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const submissionIds = (dailySubmissions ?? []).map((s) => s.id);
  let dailyAnswers: unknown[] = [];
  if (!isPeriodExport) {
    const { data, error } = await supabase.from("daily_answers").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    dailyAnswers = data ?? [];
  } else if (submissionIds.length > 0) {
    const { data, error } = await supabase
      .from("daily_answers")
      .select("*")
      .in("submission_id", submissionIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    dailyAnswers = data ?? [];
  }

  let lessonQuestionsQuery = supabase.from("lesson_questions").select("*");
  lessonQuestionsQuery = applyRange(lessonQuestionsQuery, "created_at");
  const { data: lessonQuestions, error: lessonQuestionsError } = await lessonQuestionsQuery.order(
    "created_at",
    { ascending: true }
  );
  if (lessonQuestionsError) {
    return NextResponse.json({ error: lessonQuestionsError.message }, { status: 500 });
  }

  const lessonQuestionIds = (lessonQuestions ?? []).map((q) => q.id);
  let lessonQuestionReplies: unknown[] = [];
  if (!isPeriodExport) {
    const { data, error } = await supabase.from("lesson_question_replies").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lessonQuestionReplies = data ?? [];
  } else if (lessonQuestionIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_question_replies")
      .select("*")
      .in("lesson_question_id", lessonQuestionIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lessonQuestionReplies = data ?? [];
  }

  let suggestionsQuery = supabase.from("suggestions").select("*");
  suggestionsQuery = applyRange(suggestionsQuery, "created_at");
  const { data: suggestions, error: suggestionsError } = await suggestionsQuery.order(
    "created_at",
    { ascending: true }
  );
  if (suggestionsError) {
    return NextResponse.json({ error: suggestionsError.message }, { status: 500 });
  }

  const { data: bibleVerses, error: bibleVersesError } = await supabase
    .from("bible_verses")
    .select("*")
    .order("created_at", { ascending: true });
  if (bibleVersesError) {
    return NextResponse.json({ error: bibleVersesError.message }, { status: 500 });
  }

  const { data: verseGameScores, error: verseGameScoresError } = await supabase
    .from("verse_game_scores")
    .select("*")
    .order("best_score", { ascending: false });
  if (verseGameScoresError) {
    return NextResponse.json({ error: verseGameScoresError.message }, { status: 500 });
  }

  let activityLogQuery = supabase.from("admin_activity_log").select("*");
  activityLogQuery = applyRange(activityLogQuery, "created_at");
  const { data: adminActivityLog, error: adminActivityLogError } = await activityLogQuery.order(
    "created_at",
    { ascending: true }
  );
  if (adminActivityLogError) {
    return NextResponse.json({ error: adminActivityLogError.message }, { status: 500 });
  }

  const tables = {
    site_settings: siteSettings ?? [],
    daily_quizzes: dailyQuizzes ?? [],
    daily_questions: dailyQuestions ?? [],
    participants: participants ?? [],
    daily_submissions: dailySubmissions ?? [],
    daily_answers: dailyAnswers,
    lesson_questions: lessonQuestions ?? [],
    lesson_question_replies: lessonQuestionReplies,
    suggestions: suggestions ?? [],
    bible_verses: bibleVerses ?? [],
    verse_game_scores: verseGameScores ?? [],
    admin_activity_log: adminActivityLog ?? [],
  };

  const counts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length])
  );

  const payload = {
    type: isPeriodExport ? "period" : "full",
    exportedAt: new Date().toISOString(),
    range: { from: from ?? null, to: to ?? null },
    counts,
    tables,
  };

  const json = JSON.stringify(payload, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="quiz-mef-sauvegarde-${
        isPeriodExport ? "periode" : "complete"
      }-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
