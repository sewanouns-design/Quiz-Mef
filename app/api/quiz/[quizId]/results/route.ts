import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isPassingScore } from "@/lib/scoring";
import type { CorrectedAnswer, DailyQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  if (!deviceKey) {
    return NextResponse.json({ error: "deviceKey requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: quiz, error: quizError } = await supabase
    .from("daily_quizzes")
    .select("*")
    .eq("id", params.quizId)
    .maybeSingle();

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Aucune soumission trouvée" }, { status: 404 });
  }

  const { data: submissions, error: submissionError } = await supabase
    .from("daily_submissions")
    .select("*")
    .eq("quiz_id", params.quizId)
    .eq("participant_id", participant.id)
    .order("attempt_number", { ascending: false });

  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }
  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ error: "Aucune soumission trouvée" }, { status: 404 });
  }

  // On affiche la tentative la plus récente (la définitive).
  const submission = submissions[0];
  const passed = !submission.cancelled && isPassingScore(submission.score, submission.max_score);
  const canRetry = !passed && submission.attempt_number === 1 && submissions.length === 1;

  const { data: questions, error: questionsError } = await supabase
    .from("daily_questions")
    .select("*")
    .eq("quiz_id", params.quizId)
    .order("position", { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  const { data: answers, error: answersError } = await supabase
    .from("daily_answers")
    .select("*")
    .eq("submission_id", submission.id);

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

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

  return NextResponse.json({
    quiz,
    score: submission.score,
    maxScore: submission.max_score,
    cancelled: submission.cancelled,
    cancelReason: submission.cancel_reason,
    attemptNumber: submission.attempt_number,
    canRetry,
    answers: corrected,
  });
}
