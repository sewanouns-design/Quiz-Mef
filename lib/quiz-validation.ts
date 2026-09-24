export const REQUIRED_TOTAL_POINTS = 20;

const VALID_TYPES = ["mcq", "true_false", "short", "fill_blank", "open"];

export interface QuizValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validation stricte des questions d'un quiz, utilisée à la fois à la
 * création et à la modification (client ET serveur) : chaque question doit
 * avoir un texte, un QCM doit avoir au moins 2 options et une bonne réponse
 * valide, une réponse courte doit avoir un texte attendu non vide, et le
 * total des points de toutes les questions doit être exactement 20.
 */
export function validateQuizQuestions(questions: unknown): QuizValidationResult {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, error: "Le quiz doit contenir au moins une question." };
  }

  let totalPoints = 0;

  for (let i = 0; i < questions.length; i++) {
    const raw = questions[i];
    if (typeof raw !== "object" || raw === null) {
      return { valid: false, error: `Question ${i + 1} : format invalide.` };
    }
    const question = raw as Record<string, unknown>;

    if (!VALID_TYPES.includes(question.type as string)) {
      return { valid: false, error: `Question ${i + 1} : type invalide.` };
    }

    if (typeof question.question !== "string" || question.question.trim().length === 0) {
      return { valid: false, error: `Question ${i + 1} : le texte de la question est requis.` };
    }

    if (typeof question.points !== "number" || question.points <= 0) {
      return {
        valid: false,
        error: `Question ${i + 1} : les points doivent être un nombre positif.`,
      };
    }

    if (question.type === "mcq" || question.type === "true_false") {
      const options = question.options;
      if (!Array.isArray(options) || options.length < 2) {
        return { valid: false, error: `Question ${i + 1} : au moins 2 options sont requises.` };
      }
      const correctOption = question.correctOption;
      if (
        typeof correctOption !== "number" ||
        correctOption < 0 ||
        correctOption >= options.length
      ) {
        return {
          valid: false,
          error: `Question ${i + 1} : sélectionne la bonne réponse parmi les options.`,
        };
      }
    }

    if (question.type === "short" || question.type === "fill_blank") {
      if (typeof question.correctText !== "string" || question.correctText.trim().length === 0) {
        return { valid: false, error: `Question ${i + 1} : la réponse attendue est requise.` };
      }
    }

    if (question.type !== "open") {
      if (
        typeof question.justification !== "string" ||
        question.justification.trim().length === 0
      ) {
        return {
          valid: false,
          error: `Question ${i + 1} : une justification est requise pour expliquer la bonne réponse aux apprenants.`,
        };
      }
    }

    totalPoints += question.points;
  }

  if (totalPoints !== REQUIRED_TOTAL_POINTS) {
    return {
      valid: false,
      error: `Le total des points doit être exactement ${REQUIRED_TOTAL_POINTS} (actuellement ${totalPoints}).`,
    };
  }

  return { valid: true };
}
