export const PASS_THRESHOLD = 0.6;

/** Nombre maximum de tentatives réelles (annulées exclues) autorisées par quiz. */
export const MAX_ATTEMPTS = 3;

export function isPassingScore(score: number, maxScore: number): boolean {
  return maxScore > 0 && score / maxScore >= PASS_THRESHOLD;
}

/**
 * Pour un quiz pédagogique, les corrections d'un échec restent masquées tant
 * qu'il reste une tentative autorisée. L'examen trimestriel ne révèle jamais
 * sa correction détaillée aux participants.
 */
export function shouldRevealAnswers(
  score: number,
  maxScore: number,
  attemptNumber: number,
  category: "daily" | "weekly" | "quarterly" = "daily"
): boolean {
  if (category === "quarterly") return false;
  if (isPassingScore(score, maxScore)) return true;
  return attemptNumber >= MAX_ATTEMPTS;
}

/** Nombre de tentatives réelles encore disponibles pour un participant qui
 * n'a pas encore atteint la moyenne. Après réussite, les reprises sont libres
 * et cette fonction n'est pas utilisée pour bloquer le parcours.
 */
export function attemptsRemaining(realAttemptsCount: number): number {
  return Math.max(0, MAX_ATTEMPTS - realAttemptsCount);
}
