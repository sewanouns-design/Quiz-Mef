import { normalizeAnswerText } from "./grading";
import { REQUIRED_TOTAL_POINTS, validateQuizQuestions } from "./quiz-validation";
import type { QuestionImport, QuestionType } from "./types";

const VALID_TYPES: QuestionType[] = ["mcq", "true_false", "short", "fill_blank", "open"];

const ARRAY_PATHS = ["questions", "quiz.questions", "items", "data.questions", "data.quiz.questions", "data.items"];

const QUESTION_TEXT_KEYS = ["question", "text", "enonce", "libelle", "intitule", "prompt"];
const OPTIONS_KEYS = ["options", "choices", "propositions", "reponses", "answers", "choix"];
const CORRECT_OPTION_KEYS = [
  "correctoption",
  "correct_option",
  "answer",
  "correctanswer",
  "correct_answer",
  "correct",
  "reponsecorrecte",
  "bonnereponse",
  "index",
  "correctindex",
];
const CORRECT_TEXT_KEYS = [
  "correcttext",
  "correct_text",
  "answer",
  "reponse",
  "reponseattendue",
  "texteattendu",
  "expected",
  "expectedanswer",
];
const TYPE_KEYS = ["type", "questiontype", "kind"];
const POINTS_KEYS = ["points", "point", "score", "valeur"];
const ID_KEYS = ["id", "_id", "uuid"];
const JUSTIFICATION_KEYS = ["justification", "explanation", "explication", "raison"];

/** Normalise une clé d'objet pour comparaison tolérante : accents, casse, séparateurs. */
function normalizeKey(key: string): string {
  return key
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findField(obj: Record<string, unknown>, candidates: string[]): unknown {
  const normalizedCandidates = candidates.map(normalizeKey);
  for (const key of Object.keys(obj)) {
    if (normalizedCandidates.includes(normalizeKey(key))) {
      return obj[key];
    }
  }
  return undefined;
}

/** Cherche le tableau de questions, quelle que soit la forme d'emballage du JSON fourni. */
function locateQuestionsArray(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (typeof input !== "object" || input === null) return null;

  for (const path of ARRAY_PATHS) {
    let current: unknown = input;
    for (const part of path.split(".")) {
      if (typeof current !== "object" || current === null) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (Array.isArray(current)) return current;
  }

  // Repli générique : la première propriété de premier niveau qui est un
  // tableau d'objets, quel que soit son nom.
  for (const value of Object.values(input as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      return value;
    }
  }

  return null;
}

function letterToIndex(letter: string): number | null {
  const c = letter.trim().toUpperCase();
  if (c.length === 1 && c >= "A" && c <= "Z") return c.charCodeAt(0) - 65;
  return null;
}

/** Devine l'index (0-based) de la bonne réponse, quelle que soit sa forme d'origine. */
function resolveCorrectOption(rawAnswer: unknown, options: string[]): number | null {
  if (rawAnswer === undefined || rawAnswer === null) return null;

  if (typeof rawAnswer === "boolean" && options.length === 2) {
    return rawAnswer ? 0 : 1;
  }

  if (typeof rawAnswer === "number") {
    if (Number.isInteger(rawAnswer) && rawAnswer >= 0 && rawAnswer < options.length) {
      return rawAnswer;
    }
    if (Number.isInteger(rawAnswer) && rawAnswer >= 1 && rawAnswer <= options.length) {
      return rawAnswer - 1;
    }
    return null;
  }

  if (typeof rawAnswer === "string") {
    const trimmed = rawAnswer.trim();
    if (trimmed.length === 0) return null;

    const letterIndex = letterToIndex(trimmed);
    if (letterIndex !== null && letterIndex < options.length) return letterIndex;

    if (/^-?\d+$/.test(trimmed)) {
      return resolveCorrectOption(Number(trimmed), options);
    }

    const normalizedTarget = normalizeAnswerText(trimmed);
    const matchIndex = options.findIndex((opt) => normalizeAnswerText(opt) === normalizedTarget);
    if (matchIndex !== -1) return matchIndex;

    return null;
  }

  return null;
}

function normalizeQuestion(raw: unknown, index: number): { question?: QuestionImport; error?: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: `Question ${index + 1} : format invalide.` };
  }
  const obj = raw as Record<string, unknown>;

  const id = findField(obj, ID_KEYS);
  const questionText = findField(obj, QUESTION_TEXT_KEYS);
  const optionsRaw = findField(obj, OPTIONS_KEYS);
  const options = Array.isArray(optionsRaw) ? optionsRaw.map((o) => String(o)) : undefined;
  const explicitType = findField(obj, TYPE_KEYS);
  const correctTextRaw = findField(obj, CORRECT_TEXT_KEYS);
  const correctAnswerRaw = findField(obj, CORRECT_OPTION_KEYS);
  const justification = findField(obj, JUSTIFICATION_KEYS);
  const pointsRaw = findField(obj, POINTS_KEYS);

  if (typeof questionText !== "string" || questionText.trim().length === 0) {
    return { error: `Question ${index + 1} : texte de la question introuvable.` };
  }

  let type: QuestionType;
  if (
    typeof explicitType === "string" &&
    VALID_TYPES.includes(explicitType.toLowerCase() as QuestionType)
  ) {
    type = explicitType.toLowerCase() as QuestionType;
  } else if (options && options.length >= 2) {
    type = "mcq";
  } else if (
    (typeof correctTextRaw === "string" && correctTextRaw.trim().length > 0) ||
    (typeof correctAnswerRaw === "string" && correctAnswerRaw.trim().length > 0)
  ) {
    type = "short";
  } else {
    type = "open";
  }

  const points = typeof pointsRaw === "number" && pointsRaw > 0 ? pointsRaw : undefined;
  const idValue = typeof id === "string" ? id : undefined;
  const justificationValue = typeof justification === "string" ? justification : undefined;

  if (type === "mcq" || type === "true_false") {
    if (!options || options.length < 2) {
      return { error: `Question ${index + 1} : au moins 2 options sont requises pour un QCM.` };
    }
    const answerCandidate = correctAnswerRaw ?? correctTextRaw;
    const correctOption = resolveCorrectOption(answerCandidate, options);
    if (correctOption === null) {
      return {
        error: `Question ${index + 1} : impossible de déterminer la bonne réponse parmi les options fournies.`,
      };
    }
    return {
      question: {
        id: idValue,
        type,
        question: questionText.trim(),
        options,
        correctOption,
        justification: justificationValue,
        points: points as number,
      },
    };
  }

  if (type === "short" || type === "fill_blank") {
    const text = correctTextRaw ?? correctAnswerRaw;
    if (typeof text !== "string" || text.trim().length === 0) {
      return { error: `Question ${index + 1} : réponse attendue manquante.` };
    }
    return {
      question: {
        id: idValue,
        type,
        question: questionText.trim(),
        correctText: text.trim(),
        justification: justificationValue,
        points: points as number,
      },
    };
  }

  return {
    question: {
      id: idValue,
      type: "open",
      question: questionText.trim(),
      justification: justificationValue,
      points: points as number,
    },
  };
}

export type QuizImportResult =
  | { success: true; questions: QuestionImport[]; pointsAutoDistributed: boolean }
  | { success: false; error: string };

/**
 * Parseur tolérant : accepte un JSON généré par une IA ou collé/importé à la
 * main, quelle que soit sa forme exacte (emballage, noms de champs, format de
 * la bonne réponse, type implicite, points manquants) — voir la doc dans
 * PROMPT_QUIZ.md, qui doit rester synchronisée avec ce que ce parseur accepte.
 */
export function parseQuizQuestionsInput(rawInput: unknown): QuizImportResult {
  const array = locateQuestionsArray(rawInput);
  if (!array || array.length === 0) {
    return { success: false, error: "Aucun tableau de questions trouvé dans le JSON fourni." };
  }

  const normalized: QuestionImport[] = [];
  for (let i = 0; i < array.length; i++) {
    const result = normalizeQuestion(array[i], i);
    if (result.error || !result.question) {
      return { success: false, error: result.error ?? `Question ${i + 1} : format invalide.` };
    }
    normalized.push(result.question);
  }

  // Distribue les points manquants pour atteindre exactement 20 au total,
  // plutôt que de rejeter le fichier.
  const explicitTotal = normalized.reduce((sum, q) => sum + (q.points ?? 0), 0);
  const missingIndexes = normalized
    .map((q, i) => (q.points === undefined ? i : -1))
    .filter((i) => i !== -1);

  const pointsAutoDistributed = missingIndexes.length > 0;
  if (pointsAutoDistributed) {
    const remaining = REQUIRED_TOTAL_POINTS - explicitTotal;
    const base = Math.floor(remaining / missingIndexes.length);
    const extra = remaining - base * missingIndexes.length;
    missingIndexes.forEach((qi, order) => {
      normalized[qi].points = base + (order < extra ? 1 : 0);
    });
  }

  const finalTotal = normalized.reduce((sum, q) => sum + (q.points ?? 0), 0);
  if (finalTotal !== REQUIRED_TOTAL_POINTS) {
    return {
      success: false,
      error: `Le total des points doit être exactement ${REQUIRED_TOTAL_POINTS} (obtenu : ${finalTotal}${
        pointsAutoDistributed ? ", après distribution automatique des points manquants" : ""
      }).`,
    };
  }

  const finalValidation = validateQuizQuestions(normalized);
  if (!finalValidation.valid) {
    return { success: false, error: finalValidation.error ?? "Les questions ne sont pas valides." };
  }

  return { success: true, questions: normalized, pointsAutoDistributed };
}
