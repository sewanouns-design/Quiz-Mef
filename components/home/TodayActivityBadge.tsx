export interface TodayStats {
  count: number;
  bestPercent: number | null;
}

/** Meilleur score du jour, juste à côté du bouton "Commencer" — l'activité
 * nommée (qui vient de passer le quiz) est affichée par LiveActivityTicker. */
export default function TodayActivityBadge({
  todayStats,
  accentColor,
}: {
  todayStats: TodayStats | null;
  accentColor: string;
}) {
  if (!todayStats || todayStats.count === 0 || todayStats.bestPercent === null) return null;

  return (
    <p className="mt-3 text-sm font-medium" style={{ color: accentColor }}>
      🏆 Meilleur score aujourd&apos;hui : {todayStats.bestPercent}%
    </p>
  );
}
