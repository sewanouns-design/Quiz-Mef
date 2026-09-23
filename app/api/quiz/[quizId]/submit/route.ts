import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendResultsEmail } from "@/lib/email";
import type { AnswerInput, CorrectedAnswer, DailyQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function gradeAnswer(
  question: DailyQuestion,
  input: AnswerInput | undefined
): { isCorrect: boolean | null; pointsAwarded: number } {
  if (question.type === "mcq" || question.type === "true_false") {
    const selected = input?.selectedOption;
    const isCorrect =
      typeof selected === "number" && selected === question.correct_option;
    return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
  }

  if (question.type === "short" || question.type === "fill_blank") {
    const given = input?.answerText ?? "";
    const correct = question.correct_text ?? "";
    const isCorrect = given.trim().length > 0 && normalize(given) === normalize(correct);
    return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
  }

  // Questions ouvertes : nécessitent une correction manuelle.
  return { isCorrect: null, pointsAwarded: 0 };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const body = await request.json();
  const { deviceKey, answers } = body ?? {};

  if (!deviceKey || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "deviceKey et answers sont requis" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("*")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
  }

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

  const { data: existingSubmission } = await supabase
    .from("daily_submissions")
    .select("id")
    .eq("quiz_id", params.quizId)
    .eq("participant_id", participant.id)
    .maybeSingle();

  if (existingSubmission) {
    return NextResponse.json(
      { error: "Tu as déjà soumis ce quiz." },
      { status: 409 }
    );
  }

  const { data: questions, error: questionsError } = await supabase
    .from("daily_questions")
    .select("*")
    .eq("quiz_id", params.quizId)
    .order("position", { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Ce quiz n'a pas de questions." }, { status: 400 });
  }

  const answersByQuestionId = new Map<string, AnswerInput>(
    (answers as AnswerInput[]).map((a) => [a.questionId, a])
  );

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

    maxScore += question.points;
    score += pointsAwarded;

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

  const { data: submission, error: submissionError } = await supabase
    .from("daily_submissions")
    .insert({
      quiz_id: params.quizId,
      participant_id: participant.id,
      score,
      max_score: maxScore,
    })
    .select()
    .single();

  if (submissionError || !submission) {
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

  if (participant.email) {
    try {
      await sendResultsEmail({
        to: participant.email,
        participantName: participant.name,
        quizTitle: quiz.title,
        lessonDate: quiz.lesson_date,
        score,
        maxScore,
        answers: corrected,
      });
    } catch (err) {
      console.error("Erreur envoi email de résultats :", err);
    }
  }

  return NextResponse.json({
    submissionId: submission.id,
    score,
    maxScore,
    answers: corrected,
  });
}
