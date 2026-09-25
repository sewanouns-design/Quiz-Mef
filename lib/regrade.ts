import { getSupabaseAdmin } from "./supabase";
import { gradeAnswer, isAutoGraded } from "./grading";
import type { DailyQuestion } from "./types";

export interface RegradeResult {
  questionsChecked: number;
  answersUpdated: number;
  submissionsUpdated: number;
}

/**
 * Source UNIQUE de recalcul des notes pour un quiz : relit les bonnes
 * réponses actuelles de chaque question, réévalue toutes les réponses déjà
 * enregistrées via gradeAnswer() — la même fonction que celle utilisée à la
 * soumission, jamais une copie — puis recalcule le score total de chaque
 * copie concernée.
 *
 * Appelée : (1) automatiquement après toute modification des questions d'un
 * quiz existant (voir app/api/admin/quiz/[quizId]), (2) à la demande via le
 * bouton admin « Recalculer les notes ».
 */
export async function regradeQuiz(quizId: string): Promise<RegradeResult> {
  const supabase = getSupabaseAdmin();

  const { data: questions, error: questionsError } = await supabase
    .from("daily_questions")
    .select("*")
    .eq("quiz_id", quizId);

  if (questionsError) throw new Error(questionsError.message);
  const questionById = new Map(
    (questions ?? []).map((q) => [q.id as string, q as DailyQuestion])
  );

  const { data: submissions, error: submissionsError } = await supabase
    .from("daily_submissions")
    .select("id, score, max_score")
    .eq("quiz_id", quizId);

  if (submissionsError) throw new Error(submissionsError.message);
  if (!submissions || submissions.length === 0) {
    return { questionsChecked: questionById.size, answersUpdated: 0, submissionsUpdated: 0 };
  }

  const submissionIds = submissions.map((s) => s.id);
  const originalBySubmission = new Map(
    submissions.map((s) => [s.id as string, { score: s.score, maxScore: s.max_score }])
  );

  const { data: answers, error: answersError } = await supabase
    .from("daily_answers")
    .select("*")
    .in("submission_id", submissionIds);

  if (answersError) throw new Error(answersError.message);

  let answersUpdated = 0;
  // Une soumission sans AUCUNE réponse enregistrée (anomalie de données,
  // insertion interrompue...) n'est jamais réinitialisée à 0 ici : elle est
  // tout simplement exclue du recalcul, plutôt que d'écraser une note déjà
  // existante avec un score à zéro.
  const answeredSubmissionIds = new Set((answers ?? []).map((a) => a.submission_id as string));
  const totalsBySubmission = new Map<string, { score: number; maxScore: number }>();
  for (const id of submissionIds) {
    if (answeredSubmissionIds.has(id)) totalsBySubmission.set(id, { score: 0, maxScore: 0 });
  }

  for (const answer of answers ?? []) {
    const totals = totalsBySubmission.get(answer.submission_id);
    if (!totals) continue;

    const question = answer.question_id ? questionById.get(answer.question_id) : undefined;
    if (!question) {
      // La question référencée a été supprimée depuis (question_id passe à
      // null via ON DELETE SET NULL) : elle ne compte plus dans le total.
      continue;
    }

    const { isCorrect, pointsAwarded } = gradeAnswer(question, {
      questionId: question.id,
      selectedOption: answer.selected_option ?? undefined,
      answerText: answer.answer_text ?? undefined,
    });

    if (isAutoGraded(question.type)) {
      totals.maxScore += question.points;
      totals.score += pointsAwarded;
    }

    if (answer.is_correct !== isCorrect || answer.points_awarded !== pointsAwarded) {
      const { error: updateError } = await supabase
        .from("daily_answers")
        .update({ is_correct: isCorrect, points_awarded: pointsAwarded })
        .eq("id", answer.id);
      if (updateError) throw new Error(updateError.message);
      answersUpdated += 1;
    }
  }

  let submissionsUpdated = 0;
  for (const [submissionId, totals] of totalsBySubmission) {
    const original = originalBySubmission.get(submissionId);
    if (original && original.score === totals.score && original.maxScore === totals.maxScore) {
      continue;
    }
    const { error: updateError } = await supabase
      .from("daily_submissions")
      .update({ score: totals.score, max_score: totals.maxScore })
      .eq("id", submissionId);
    if (updateError) throw new Error(updateError.message);
    submissionsUpdated += 1;
  }

  return { questionsChecked: questionById.size, answersUpdated, submissionsUpdated };
}
