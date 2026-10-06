import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { attemptsRemaining, isPassingScore, MAX_ATTEMPTS, shouldRevealAnswers } from "@/lib/scoring";
import { redactAnswersIfHidden } from "@/lib/grading";
import { computeStreakDays } from "@/lib/streak";
import type { CorrectedAnswer, DailyQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string; token: string } }
) {
  const supabase = getSupabaseAdmin();

  // Le quiz, la soumission (identifiée par le jeton) et les questions sont
  // tous indépendants les uns des autres : les charger en une seule rafale
  // plutôt que l'un après l'autre évite 2 allers-retours réseau inutiles.
  const [
    { data: quiz, error: quizError },
    { data: submission, error: submissionError },
    { data: questions, error: questionsError },
  ] = await Promise.all([
    supabase.from("daily_quizzes").select("*").eq("id", params.quizId).maybeSingle(),
    // Le jeton est non devinable (UUID) : il identifie une soumission précise
    // sans exposer d'ID séquentiel ni dépendre du localStorage de l'appareil.
    supabase
      .from("daily_submissions")
      .select("*")
      .eq("quiz_id", params.quizId)
      .eq("result_token", params.token)
      .maybeSingle(),
    supabase
      .from("daily_questions")
      .select("*")
      .eq("quiz_id", params.quizId)
      .order("position", { ascending: true }),
  ]);

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: "Résultat introuvable" }, { status: 404 });
  }

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  // Tout ce qui suit ne dépend que de la soumission ci-dessus (son
  // participant_id ou son id) : à nouveau, une seule rafale au lieu de 5
  // allers-retours séquentiels.
  const [
    { data: allAttempts },
    { data: participant },
    { data: streakSubmissions },
    { data: answers, error: answersError },
    { data: lessonQuestions },
  ] = await Promise.all([
    // On indique si une nouvelle tentative est encore possible pour CE
    // participant, pas seulement pour cette soumission précise — les
    // tentatives annulées (sortie de page répétée, appel entrant...) ne
    // comptent jamais comme de vraies tentatives.
    supabase
      .from("daily_submissions")
      .select("score, max_score, cancelled")
      .eq("quiz_id", params.quizId)
      .eq("participant_id", submission.participant_id),
    supabase.from("participants").select("name").eq("id", submission.participant_id).maybeSingle(),
    // Série (streak) : jours consécutifs avec au moins une vraie soumission,
    // tous quiz confondus (un par jour) — pas seulement celui-ci.
    supabase
      .from("daily_submissions")
      .select("submitted_at")
      .eq("participant_id", submission.participant_id)
      .eq("cancelled", false)
      .order("submitted_at", { ascending: false })
      .limit(60),
    supabase.from("daily_answers").select("*").eq("submission_id", submission.id),
    supabase
      .from("lesson_questions")
      .select("id, question_text, created_at, replies:lesson_question_replies(id, sender, message, created_at)")
      .eq("quiz_id", params.quizId)
      .eq("participant_id", submission.participant_id)
      .order("created_at", { ascending: true }),
  ]);

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  const realAttempts = (allAttempts ?? []).filter((s) => !s.cancelled);
  const passedAny = realAttempts.some((s) => isPassingScore(s.score, s.max_score));
  const canRetry = !passedAny && realAttempts.length < MAX_ATTEMPTS;
  const remaining = attemptsRemaining(realAttempts.length, passedAny);

  const streakDays = computeStreakDays((streakSubmissions ?? []).map((s) => s.submitted_at));

  const answersByQuestionId = new Map((answers ?? []).map((a) => [a.question_id, a]));

  const corrected: CorrectedAnswer[] = (questions as DailyQuestion[]).map((question) => {
    const answer = answersByQuestionId.get(question.id);
    return {
      questionId: question.id,
      question: question.question,
      type: question.type,
      options: question.options,
      participantSelectedOption: answer?.selected_option ?? null,
      participantAnswerText: answer?.answer_text ?? null,
      correctOption: question.correct_option,
      correctText: question.correct_text,
      justification: question.justification,
      isCorrect: answer?.is_correct ?? null,
      pointsAwarded: answer?.points_awarded ?? 0,
      points: question.points,
    };
  });

  const reveal =
    submission.cancelled || shouldRevealAnswers(submission.score, submission.max_score, submission.attempt_number);

  const lessonQuestionThreads = (lessonQuestions ?? []).map((q) => {
    const replies = (q as unknown as { replies: { id: string; sender: string; message: string; created_at: string }[] })
      .replies ?? [];
    return {
      id: q.id,
      questionText: q.question_text,
      createdAt: q.created_at,
      replies: [...replies].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    };
  });

  return NextResponse.json({
    quiz: { id: quiz.id, title: quiz.title },
    participantName: participant?.name ?? "",
    score: submission.score,
    maxScore: submission.max_score,
    openScore: submission.open_score,
    cancelled: submission.cancelled,
    cancelReason: submission.cancel_reason,
    attemptNumber: submission.attempt_number,
    canRetry,
    attemptsRemaining: remaining,
    streakDays,
    answers: redactAnswersIfHidden(corrected, reveal),
    lessonQuestions: lessonQuestionThreads,
  });
}
