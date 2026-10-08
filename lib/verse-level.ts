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

// Un verset court n'est pas forcément facile : les phrases formulaires
// d'attribution de parole ("L'Éternel parla à Moïse, et dit :") et les
// listes de noms (généalogies, listes de villes/tribus — "Serug, Nachor,
// Térach,") sont courtes mais quasiment impossibles à relier à une
// référence précise : elles se répètent à l'identique dans des dizaines de
// chapitres, ou n'apportent aucun indice de contexte reconnaissable. On les
// classe difficiles d'office plutôt que selon leur seule longueur.
const HARD_OVERRIDE_LEVEL = 85;
const HARD_OVERRIDE_MAX_LENGTH = 90;

const FORMULAIC_SPEECH_PATTERN = /(l.?éternel|dieu)\b.{0,40}\b(parla|parle|dit)\b.{0,12}à\b/i;
const GENEALOGY_PATTERN = /\bengendra\b/i;

// Noms/titres bibliques assez connus pour ne pas compter comme "nom
// bizarre" dans l'heuristique ci-dessous (sinon de nombreux versets très
// connus, qui ne sont pas du tout difficiles, seraient classés à tort).
const COMMON_BIBLICAL_NAMES = new Set([
  "Dieu", "Seigneur", "Éternel", "Jésus", "Jésus-Christ", "Christ", "Esprit", "Israël", "Juda",
  "Jérusalem", "Sion", "Égypte", "Moïse", "Abraham", "Isaac", "Jacob", "David", "Salomon", "Pierre",
  "Paul", "Jean", "Jacques", "Marie", "Adam", "Noé", "Satan", "Galilée", "Judée", "Samarie",
  "Babylone", "Rome", "Éphraïm", "Benjamin", "Lévi", "Aaron", "Josué", "Samuel", "Saül", "Élie",
  "Élisée", "Ésaïe", "Jérémie", "Daniel", "Ézéchiel", "Ève", "Pharaon",
]);

const COMMON_FRENCH_WORDS = new Set([
  "Je", "Tu", "Il", "Elle", "Nous", "Vous", "Ils", "Elles", "On", "Ce", "Cette", "Ces", "Cet",
  "Celui", "Celle", "Ceux", "Celles", "Mon", "Ma", "Mes", "Ton", "Ta", "Tes", "Son", "Sa", "Ses",
  "Notre", "Nos", "Votre", "Vos", "Leur", "Leurs", "Qui", "Que", "Quoi", "Dont", "Où", "Comment",
  "Pourquoi", "Ainsi", "Alors", "Or", "Mais", "Et", "Car", "Donc", "Puis", "Voici", "Voilà", "Eh",
  "Ah", "Oh", "Ô", "Un", "Une", "Les", "La", "Le", "Des", "Du", "De", "En", "Si", "Comme",
  "Lorsque", "Après", "Avant", "Pendant", "Depuis", "Afin", "Tout", "Tous", "Toute", "Toutes",
  "Chacun", "Chaque", "Rien", "Personne", "Aucun", "Quelque", "Quelques", "Plusieurs", "Même",
  "Aussi", "Encore", "Déjà", "Jamais", "Toujours", "Bientôt", "Maintenant", "Ici", "Là", "Oui",
  "Non", "Certes",
]);

/** Repère les versets qui alignent au moins deux noms propres rares en
 * milieu de phrase (hors noms bibliques courants et mots de liaison) —
 * signe d'une liste de noms (généalogie, villes, tribus...). */
function hasObscureNameDensity(text: string): boolean {
  const words = text.split(/\s+/);
  let afterBoundary = true;
  let obscureCapCount = 0;
  for (const raw of words) {
    const clean = raw.replace(/^[«"'(]+/, "").replace(/[,.;:!?»")]+$/, "");
    if (
      /^[A-ZÀ-Ý]/.test(clean) &&
      !afterBoundary &&
      !COMMON_BIBLICAL_NAMES.has(clean) &&
      !COMMON_FRENCH_WORDS.has(clean)
    ) {
      obscureCapCount++;
    }
    afterBoundary = /[.!?:;]["')»]*$/.test(raw);
  }
  return obscureCapCount >= 2;
}

/** Niveau (1 à 100) déduit de la longueur du texte, pour un verset sans
 * niveau explicite (ajout/import sans le préciser). */
export function getVerseLevelFromText(text: string): number {
  const length = text.length;
  const index = LEVEL_LENGTH_BREAKPOINTS.findIndex((max) => length <= max);
  const baseLevel = index === -1 ? MAX_LEVEL : index + 1;

  if (
    length < HARD_OVERRIDE_MAX_LENGTH &&
    baseLevel < HARD_OVERRIDE_LEVEL &&
    (FORMULAIC_SPEECH_PATTERN.test(text) || GENEALOGY_PATTERN.test(text) || hasObscureNameDensity(text))
  ) {
    return HARD_OVERRIDE_LEVEL;
  }

  return baseLevel;
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
