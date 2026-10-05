export interface TodayStats {
  count: number;
  bestPercent: number | null;
}

/** Effet d'entraînement juste à côté du bouton "Commencer" : combien de
 * personnes ont déjà répondu aujourd'hui, et le meilleur score du jour. */
export default function TodayActivityBadge({
  todayStats,
  accentColor,
}: {
  todayStats: TodayStats | null;
  accentColor: string;
}) {
  if (!todayStats || todayStats.count === 0) return null;

  return (
    <p className="mt-3 text-sm font-medium" style={{ color: accentColor }}>
      🔥 {todayStats.count} personne{todayStats.count > 1 ? "s" : ""} déjà répondu aujourd&apos;hui
      {todayStats.bestPercent !== null && <> · 🏆 Meilleur score : {todayStats.bestPercent}%</>}
    </p>
  );
}
