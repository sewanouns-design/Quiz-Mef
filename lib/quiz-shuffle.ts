import { normalizeAnswerText } from "./grading";
import type { PublicQuestion } from "./types";

/**
 * Mélange déterministe des questions et des options d'un quiz, calculé
 * UNIQUEMENT côté client à l'affichage — le serveur note toujours par
 * questionId et par l'index ORIGINAL de l'option choisie, jamais par
 * position affichée (voir ShuffledOption.originalIndex).
 *
 * Même seed (quizId + nom normalisé du participant) => toujours le même
 * ordre pour la même personne (recharge de page, reprise après coupure),
 * mais un ordre différent d'un participant à l'autre.
 */

export interface ShuffledOption {
  label: string;
  originalIndex: number;
}

export type ShuffledQuestion = Omit<PublicQuestion, "options"> & {
  options: ShuffledOption[] | null;
};

/** FNV-1a, hash d'une chaîne en entier 32 bits non signé. */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 : PRNG déterministe rapide, suffisant pour un simple mélange. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, mélange déterministe piloté par une seed textuelle. */
function shuffleWithSeed<T>(items: T[], seedStr: string): T[] {
  const random = mulberry32(fnv1a(seedStr));
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Seed de base : quizId + nom normalisé (trim/casse/accents tolérés). */
export function buildQuizSeed(quizId: string, participantName: string): string {
  return `${quizId}:${normalizeAnswerText(participantName)}`;
}

export function buildShuffledQuestions(
  questions: PublicQuestion[],
  seed: string
): ShuffledQuestion[] {
  const shuffledQuestions = shuffleWithSeed(questions, seed);

  return shuffledQuestions.map((question) => {
    if ((question.type === "mcq" || question.type === "true_false") && question.options) {
      const indexed: ShuffledOption[] = question.options.map((label, originalIndex) => ({
        label,
        originalIndex,
      }));
      const shuffledOptions = shuffleWithSeed(indexed, `${seed}:${question.id}`);
      return { ...question, options: shuffledOptions };
    }
    return { ...question, options: null };
  });
}
