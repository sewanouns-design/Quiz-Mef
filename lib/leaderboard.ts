/**
 * "Lydie Noulehounsi" -> "Lydie N." — prénom en entier, initiale du reste,
 * jamais le nom complet : c'est tout l'intérêt du classement opt-in (visible
 * par les autres participants, jamais l'identité complète).
 */
export function formatLeaderboardName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}
