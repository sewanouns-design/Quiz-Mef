export const PASS_THRESHOLD = 0.6;

export function isPassingScore(score: number, maxScore: number): boolean {
  return maxScore > 0 && score / maxScore >= PASS_THRESHOLD;
}
