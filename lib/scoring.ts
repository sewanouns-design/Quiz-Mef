export const PASS_THRESHOLD = 0.6;

/** Nombre maximum de tentatives réelles (annulées exclues) autorisées par quiz. */
export const MAX_ATTEMPTS = 3;

export function isPassingScore(score: number, maxScore: number): boolean {
  return maxScore > 0 && score / maxScore >= PASS_THRESHOLD;
}

/**
 * Tant qu'il reste au moins une tentative réelle et que le participant n'a
 * pas atteint la moyenne, la bonne réponse et sa justification restent
 * cachées pour ses erreurs — seule la dernière tentative (échouée) les
 * révèle, pour forcer à revoir la leçon plutôt qu'à mémoriser la correction.
 */
export function shouldRevealAnswers(
  score: number,
  maxScore: number,
  attemptNumber: number
): boolean {
  if (isPassingScore(score, maxScore)) return true;
  return attemptNumber >= MAX_ATTEMPTS;
}

/** Nombre de tentatives réelles encore disponibles pour ce participant. */
export function attemptsRemaining(realAttemptsCount: number, passed: boolean): number {
  if (passed) return 0;
  return Math.max(0, MAX_ATTEMPTS - realAttemptsCount);
}
