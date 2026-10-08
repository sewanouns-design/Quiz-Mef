import type { BibleVerse, VerseDifficulty } from "./types";

/**
 * Difficulté d'un verset pour "Trouve le verset" : si l'admin l'a renseignée
 * explicitement, on la respecte. Sinon, on la déduit de la longueur du
 * texte — un verset court est généralement plus facile à repérer/compléter
 * qu'un verset long — pour que la progression de difficulté fonctionne même
 * sur une banque importée en masse où personne n'a eu le temps de classer
 * chaque verset à la main.
 */
export function getVerseDifficulty(verse: Pick<BibleVerse, "text" | "difficulty">): VerseDifficulty {
  if (verse.difficulty) return verse.difficulty;
  const length = verse.text.length;
  if (length <= 60) return "easy";
  if (length <= 120) return "medium";
  return "hard";
}
