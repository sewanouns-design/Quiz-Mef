/**
 * "Lydie Noulehounsi" -> "Lydie N." — prénom en entier, initiale du reste,
 * jamais le nom complet : le classement public utilise systématiquement le
 * prénom et l'initiale du premier nom de famille.
 */
export function formatLeaderboardName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}
