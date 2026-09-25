import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { sendResultsEmail } from "@/lib/email";
import { attemptsRemaining, isPassingScore, MAX_ATTEMPTS, shouldRevealAnswers } from "@/lib/scoring";
import { gradeAnswer, isAutoGraded, normalizeName, redactAnswersIfHidden } from "@/lib/grading";
import { getClientIp, isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";
import type { AnswerInput, CorrectedAnswer, DailyQuestion } from "@/lib/types";

const RATE_LIMIT_ROUTE = "quiz-submit";
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MINUTES = 15;

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (await isRateLimited(ip, RATE_LIMIT_ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }
  await recordRateLimitEvent(ip, RATE_LIMIT_ROUTE);

  const body = await request.json();
  const { deviceKey, answers, cancelled, cancelReason } = body ?? {};

  if (!deviceKey || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "deviceKey et answers sont requis" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Participant, quiz et questions sont indépendants les uns des autres :
  // les charger en parallèle plutôt que séquentiellement réduit d'autant la
  // latence perçue par le participant au moment le plus sensible (l'envoi de
  // ses réponses). Les vérifications qui suivent gardent le même ordre de
  // priorité qu'avant pour ne rien changer au comportement observé.
  const [
    { data: participant, error: participantError },
    { data: quiz, error: quizError },
    { data: questions, error: questionsError },
  ] = await Promise.all([
    supabase.from("participants").select("*").eq("device_key", deviceKey).maybeSingle(),
    supabase.from("daily_quizzes").select("*").eq("id", params.quizId).maybeSingle(),
    supabase
      .from("daily_questions")
      .select("*")
      .eq("quiz_id", params.quizId)
      .order("position", { ascending: true }),
  ]);

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
  }

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  const { data: existingSubmissions, error: existingError } = await supabase
    .from("daily_submissions")
    .select("score, max_score, cancelled, attempt_number")
    .eq("quiz_id", params.quizId)
    .eq("participant_id", participant.id)
    .order("attempt_number", { ascending: true });

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  // Une tentative annulée (sortie de page répétée, appel entrant...) ne
  // compte jamais comme une vraie tentative : elle ne doit ni bloquer un
  // nouvel essai, ni faire perdre au participant l'une de ses chances.
  const realAttempts = (existingSubmissions ?? []).filter((s) => !s.cancelled);
  const passedAny = realAttempts.some((s) => isPassingScore(s.score, s.max_score));

  // Une nouvelle tentative n'est permise que si aucune précédente n'a atteint
  // 60 % et que le nombre maximum de tentatives réelles n'est pas atteint.
  if (passedAny || realAttempts.length >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Tu as déjà soumis ce quiz." },
      { status: 409 }
    );
  }
  const attemptNumber = realAttempts.length + 1;

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Ce quiz n'a pas de questions." }, { status: 400 });
  }

  const answersByQuestionId = new Map<string, AnswerInput>(
    (answers as AnswerInput[]).map((a) => [a.questionId, a])
  );

  // Score auto-corrigé (QCM + réponse courte) uniquement : les questions
  // ouvertes ne sont jamais notées automatiquement, donc elles ne comptent
  // pas dans le score max ici (sinon le pourcentage serait injustement
  // plafonné en dessous de 100 %). Leur correction manuelle alimente
  // séparément submission.open_score.
  let score = 0;
  let maxScore = 0;
  const corrected: CorrectedAnswer[] = [];
  const answerRows: Array<{
    question_id: string;
    selected_option: number | null;
    answer_text: string | null;
    is_correct: boolean | null;
    points_awarded: number;
  }> = [];

  for (const question of questions as DailyQuestion[]) {
    const input = answersByQuestionId.get(question.id);
    const { isCorrect, pointsAwarded } = gradeAnswer(question, input);

    if (isAutoGraded(question.type)) {
      maxScore += question.points;
      score += pointsAwarded;
    }

    answerRows.push({
      question_id: question.id,
      selected_option: input?.selectedOption ?? null,
      answer_text: input?.answerText ?? null,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
    });

    corrected.push({
      questionId: question.id,
      question: question.question,
      type: question.type,
      options: question.options,
      participantSelectedOption: input?.selectedOption ?? null,
      participantAnswerText: input?.answerText ?? null,
      correctOption: question.correct_option,
      correctText: question.correct_text,
      justification: question.justification,
      isCorrect,
      pointsAwarded,
      points: question.points,
    });
  }

  const isCancelled = cancelled === true;
  const { data: submission, error: submissionError } = await supabase
    .from("daily_submissions")
    .insert({
      quiz_id: params.quizId,
      participant_id: participant.id,
      score,
      max_score: maxScore,
      cancelled: isCancelled,
      cancel_reason: isCancelled && typeof cancelReason === "string" ? cancelReason : null,
      attempt_number: attemptNumber,
      normalized_name: normalizeName(participant.name),
      result_token: randomUUID(),
    })
    .select()
    .single();

  if (submissionError || !submission) {
    // Contrainte d'unicité (quiz_id, normalized_name, attempt_number) :
    // une soumission très similaire existe déjà (autre appareil, nom quasi
    // identique) — on ne la traite pas comme une erreur serveur générique.
    if (submissionError?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "Une soumission avec un nom très similaire existe déjà pour ce test. Si ce n'est pas toi, contacte l'organisateur.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: submissionError?.message ?? "Erreur lors de la soumission" },
      { status: 500 }
    );
  }

  const { error: answersError } = await supabase.from("daily_answers").insert(
    answerRows.map((row) => ({ ...row, submission_id: submission.id }))
  );

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  // Tant qu'il reste des tentatives réelles et que la moyenne n'est pas
  // atteinte, la bonne réponse et la justification des erreurs restent
  // cachées (une soumission annulée les révèle toujours, ce n'est pas une
  // vraie tentative comptabilisée).
  const passed = isPassingScore(score, maxScore);
  const reveal = isCancelled || shouldRevealAnswers(score, maxScore, attemptNumber);
  const visibleAnswers = redactAnswersIfHidden(corrected, reveal);
  const remaining = isCancelled ? MAX_ATTEMPTS - realAttempts.length : attemptsRemaining(attemptNumber, passed);

  if (participant.email) {
    try {
      await sendResultsEmail({
        to: participant.email,
        participantName: participant.name,
        quizTitle: quiz.title,
        lessonDate: quiz.lesson_date,
        score,
        maxScore,
        answers: visibleAnswers,
        cancelled: isCancelled,
        attemptNumber,
        attemptsRemaining: remaining,
      });
    } catch (err) {
      console.error("Erreur envoi email de résultats :", err);
    }
  }

  return NextResponse.json({
    submissionId: submission.id,
    resultToken: submission.result_token,
    score,
    maxScore,
    cancelled: isCancelled,
    attemptNumber,
    attemptsRemaining: remaining,
    answers: visibleAnswers,
  });
}
