/**
 * Nombre de jours consécutifs (calendaires) se terminant à la soumission la
 * plus récente de la liste. Source unique de vérité : utilisée à la fois par
 * la relance email (app/api/cron/reengagement) et par l'affichage participant
 * (résultats, "Mes stats") — ne jamais dupliquer cette logique ailleurs.
 */
export function computeStreakDays(submittedAtList: string[]): number {
  const uniqueDays = Array.from(
    new Set(submittedAtList.map((d) => new Date(d).toISOString().slice(0, 10)))
  ).sort((a, b) => b.localeCompare(a));

  if (uniqueDays.length === 0) return 0;

  let streak = 1;
  let current = new Date(`${uniqueDays[0]}T00:00:00Z`);
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(`${uniqueDays[i]}T00:00:00Z`);
    const diffDays = Math.round((current.getTime() - prev.getTime()) / 86400000);
    if (diffDays !== 1) break;
    streak += 1;
    current = prev;
  }
  return streak;
}
