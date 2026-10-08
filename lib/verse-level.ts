export const MAX_LEVEL = 100;

/**
 * Seuils de longueur de texte (en caractères) délimitant les 100 niveaux de
 * "Trouve le verset" : LEVEL_LENGTH_BREAKPOINTS[i] est la longueur maximale
 * d'un verset de niveau i+1. Calculés une fois (ntile(100) sur la longueur
 * de tous les versets importés) pour que chaque niveau contienne un nombre
 * comparable de versets ; reproduits ici pour attribuer un niveau aux
 * versets ajoutés ensuite sans avoir à recalculer la répartition sur toute
 * la table à chaque ajout (voir la migration verse_game_levels).
 */
const LEVEL_LENGTH_BREAKPOINTS = [
  36, 45, 50, 54, 57, 60, 62, 65, 66, 68, 69, 71, 72, 74, 75, 77, 78, 79, 80, 82, 83, 84, 85, 87, 88, 89,
  90, 91, 92, 94, 95, 96, 98, 99, 100, 102, 103, 104, 106, 107, 109, 110, 112, 113, 115, 116, 118, 119,
  120, 122, 123, 125, 126, 128, 129, 131, 133, 134, 136, 138, 140, 141, 143, 145, 146, 148, 150, 152, 153,
  155, 157, 159, 161, 163, 165, 168, 170, 172, 175, 177, 180, 183, 185, 188, 191, 194, 197, 200, 204, 208,
  212, 217, 222, 229, 236, 244, 254, 268, 291, Infinity,
];

/** Niveau (1 à 100) déduit de la longueur du texte, pour un verset sans
 * niveau explicite (ajout/import sans le préciser). */
export function getVerseLevelFromText(text: string): number {
  const length = text.length;
  const index = LEVEL_LENGTH_BREAKPOINTS.findIndex((max) => length <= max);
  return index === -1 ? MAX_LEVEL : index + 1;
}

/** Compatibilité avec l'ancien champ à 3 paliers (easy/medium/hard),
 * toujours accepté en import, converti en un niveau représentatif. */
const LEGACY_DIFFICULTY_LEVEL: Record<string, number> = {
  easy: 15,
  medium: 50,
  hard: 85,
};

export function resolveVerseLevel(raw: unknown, text: string): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(MAX_LEVEL, Math.max(1, Math.round(raw)));
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed in LEGACY_DIFFICULTY_LEVEL) return LEGACY_DIFFICULTY_LEVEL[trimmed];
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= MAX_LEVEL) {
      return Math.round(asNumber);
    }
  }
  return getVerseLevelFromText(text);
}
