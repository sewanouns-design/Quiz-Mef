import type { AnswerInput, CorrectedAnswer, DailyQuestion, QuestionType } from "./types";

/**
 * Normalise un texte pour comparaison : Unicode NFKC (pour que les accents
 * composés ou variantes de codage ne créent pas de faux négatifs), casse,
 * espaces en trop (début/fin + espaces multiples internes).
 */
export function normalizeAnswerText(text: string): string {
  return text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Même normalisation, utilisée pour la déduplication des noms de participants. */
export function normalizeName(name: string): string {
  return normalizeAnswerText(name);
}

/** Une réponse courte attendue peut contenir plusieurs variantes acceptées séparées par "|". */
function acceptedVariants(correctText: string): string[] {
  return correctText
    .split("|")
    .map((variant) => normalizeAnswerText(variant))
    .filter((variant) => variant.length > 0);
}

export function isAutoGraded(type: QuestionType): boolean {
  return type !== "open";
}

export interface GradeResult {
  isCorrect: boolean | null;
  pointsAwarded: number;
}

/**
 * Source UNIQUE de vérité pour la correction d'une réponse. Utilisée à la
 * fois à la soumission initiale et par le recalcul (regrade) — ne jamais
 * dupliquer cette logique ailleurs, sous peine de voir les deux versions
 * diverger (c'est exactement ce qui a causé un bug de notation).
 */
export function gradeAnswer(
  question: DailyQuestion,
  input: AnswerInput | undefined
): GradeResult {
  if (question.type === "open") {
    // Jamais noté automatiquement : en attente d'une correction manuelle.
    return { isCorrect: null, pointsAwarded: 0 };
  }

  if (question.type === "mcq" || question.type === "true_false") {
    const selected = input?.selectedOption;
    const isCorrect = typeof selected === "number" && selected === question.correct_option;
    return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
  }

  // short, fill_blank
  const given = normalizeAnswerText(input?.answerText ?? "");
  const variants = acceptedVariants(question.correct_text ?? "");
  const isCorrect = given.length > 0 && variants.includes(given);
  return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
}

/**
 * Retire la bonne réponse et la justification des réponses FAUSSES quand
 * `reveal` est faux (voir shouldRevealAnswers) — jamais des réponses
 * correctes, qui n'apprennent rien de nouveau au participant.
 */
export function redactAnswersIfHidden(
  answers: CorrectedAnswer[],
  reveal: boolean
): CorrectedAnswer[] {
  if (reveal) return answers;
  return answers.map((a) =>
    a.isCorrect === false
      ? { ...a, correctOption: null, correctText: null, justification: null }
      : a
  );
}
