import type { QuizCategory } from "./types";

export const REQUIRED_TOTAL_POINTS = 20;

const VALID_TYPES = ["mcq", "true_false", "short", "fill_blank", "open"];

export interface QuizValidationResult {
  valid: boolean;
  error?: string;
}

function isAdvancedTrueFalseOptions(options: unknown[]): boolean {
  return (
    options.length === 4 &&
    options.every(
      (option) =>
        typeof option === "string" && /^(vrai|faux)\s*,?\s+car\b/i.test(option.trim())
    )
  );
}

/**
 * Validation stricte des questions d'un quiz, utilisée à la fois à la
 * création et à la modification (client ET serveur) : chaque question doit
 * avoir un texte, un QCM doit avoir 4 options pour les quiz quotidiens et hebdomadaires
 * ou 5 options pour un quiz trimestriel, avec une bonne réponse valide,
 * une réponse courte doit avoir un texte attendu non vide, et le total des
 * points de toutes les questions doit être exactement 20.
 */
export function validateQuizQuestions(
  questions: unknown,
  category?: QuizCategory
): QuizValidationResult {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, error: "Le quiz doit contenir au moins une question." };
  }

  let totalPoints = 0;
  let advancedTrueFalseCount = 0;

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

    if ((category === "daily" || category === "weekly") && question.type !== "mcq") {
      return {
        valid: false,
        error: `Question ${i + 1} : les quiz quotidiens et hebdomadaires utilisent uniquement des QCM à 4 propositions, y compris pour le Vrai/Faux avancé.`,
      };
    }

    if (typeof question.points !== "number" || question.points <= 0) {
      return {
        valid: false,
        error: `Question ${i + 1} : les points doivent être un nombre positif.`,
      };
    }

    if (question.type === "mcq" || question.type === "true_false") {
      const options = question.options;
      if (!Array.isArray(options)) {
        return { valid: false, error: `Question ${i + 1} : les options sont requises.` };
      }
      const expectedMcqOptions = category === "quarterly" ? 5 : category ? 4 : null;
      if (
        question.type === "mcq" &&
        (expectedMcqOptions !== null
          ? options.length !== expectedMcqOptions
          : options.length !== 4 && options.length !== 5)
      ) {
        return {
          valid: false,
          error:
            expectedMcqOptions === null
              ? `Question ${i + 1} : un QCM doit contenir 4 ou 5 options.`
              : `Question ${i + 1} : un quiz ${category === "quarterly" ? "trimestriel" : "quotidien ou hebdomadaire"} doit contenir exactement ${expectedMcqOptions} options par QCM.`,
        };
      }
      if (question.type === "mcq" && category !== "quarterly" && options.length === 4) {
        const isAdvancedTrueFalse = isAdvancedTrueFalseOptions(options);
        if (isAdvancedTrueFalse) advancedTrueFalseCount += 1;
        else if (
          options.some(
            (option) => typeof option === "string" && /^(vrai|faux)\b/i.test(option.trim())
          )
        ) {
          return {
            valid: false,
            error: `Question ${i + 1} : une question Vrai/Faux doit contenir 4 propositions complètes commençant par « Vrai, car » ou « Faux, car ».`,
          };
        }
      }
      if (question.type === "true_false" && (!Array.isArray(options) || options.length < 2)) {
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

  if (category === "daily" && questions.length >= 5 && advancedTrueFalseCount < 3) {
    return {
      valid: false,
      error: `Un quiz quotidien doit contenir au moins 3 questions Vrai/Faux avancées (actuellement ${advancedTrueFalseCount}).`,
    };
  }
  if (category === "weekly" && advancedTrueFalseCount < 8) {
    return {
      valid: false,
      error: `Un quiz hebdomadaire doit contenir au moins 8 questions Vrai/Faux avancées (actuellement ${advancedTrueFalseCount}).`,
    };
  }

  return { valid: true };
}
