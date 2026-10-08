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

// La longueur d'un verset ne dit presque rien de sa vraie difficulté :
// "Je puis tout par celui qui me fortifie." (Philippiens 4:13) est très
// court ET très facile (verset archi-connu), tandis que de nombreux
// fragments poétiques courts (Psaumes, Job — "...dans les ténèbres...")
// sont longs à distinguer les uns des autres faute de contenu distinctif.
// On classe donc d'abord par popularité/caractère reconnaissable, et la
// longueur ne sert plus qu'à répartir ce qui reste à l'intérieur de la
// bande "moyen".
const EASY_BAND_MAX = 25;
const MEDIUM_BAND_MIN = 26;
const MEDIUM_BAND_MAX = 79;

/** Normalise une référence pour une comparaison robuste aux espaces. */
function normalizeReference(reference: string): string {
  return reference.trim().replace(/\s+/g, " ");
}

// Versets très connus (catéchisme, versets "d'affiche", cités de mémoire) —
// classés faciles quelle que soit leur longueur. Liste volontairement large
// mais non exhaustive ; complétée au fil du temps.
const POPULAR_VERSE_REFERENCES = new Set(
  [
    "Genèse 1:1", "Genèse 1:27", "Exode 20:3", "Exode 20:12", "Exode 20:13", "Exode 20:14",
    "Exode 20:15", "Lévitique 19:18", "Nombres 6:24", "Nombres 6:25", "Nombres 6:26",
    "Deutéronome 6:4", "Deutéronome 6:5", "Deutéronome 31:6", "Deutéronome 31:8", "Josué 1:9",
    "Josué 24:15", "1 Samuel 16:7", "2 Samuel 22:2", "Psaumes 1:1", "Psaumes 8:1", "Psaumes 19:1",
    "Psaumes 23:1", "Psaumes 23:4", "Psaumes 27:1", "Psaumes 34:8", "Psaumes 37:4", "Psaumes 46:1",
    "Psaumes 51:10", "Psaumes 55:22", "Psaumes 62:1", "Psaumes 90:1", "Psaumes 91:1",
    "Psaumes 100:1", "Psaumes 103:1", "Psaumes 118:24", "Psaumes 119:105", "Psaumes 121:1",
    "Psaumes 121:2", "Psaumes 126:5", "Psaumes 139:14", "Psaumes 150:6", "Proverbes 1:7",
    "Proverbes 3:5", "Proverbes 3:6", "Proverbes 16:3", "Proverbes 17:17", "Proverbes 22:6",
    "Proverbes 31:30", "Ecclésiaste 3:1", "Cantique des Cantiques 2:1", "Ésaïe 9:6",
    "Ésaïe 40:31", "Ésaïe 41:10", "Ésaïe 53:5", "Ésaïe 55:8", "Ésaïe 55:9", "Jérémie 17:7",
    "Jérémie 29:11", "Jérémie 33:3", "Lamentations de Jérémie 3:22", "Lamentations de Jérémie 3:23",
    "Ézéchiel 36:26", "Daniel 3:17", "Joël 2:25", "Michée 6:8", "Habacuc 2:4", "Sophonie 3:17",
    "Malachie 3:10", "Matthieu 5:3", "Matthieu 5:9", "Matthieu 5:14", "Matthieu 6:9",
    "Matthieu 6:33", "Matthieu 6:34", "Matthieu 7:7", "Matthieu 7:12", "Matthieu 11:28",
    "Matthieu 18:20", "Matthieu 19:26", "Matthieu 22:37", "Matthieu 22:39", "Matthieu 28:19",
    "Matthieu 28:20", "Marc 10:27", "Marc 11:24", "Marc 12:30", "Marc 16:15", "Luc 1:37",
    "Luc 2:10", "Luc 2:11", "Luc 6:31", "Luc 11:9", "Luc 15:7", "Luc 19:10", "Jean 1:1",
    "Jean 1:12", "Jean 1:14", "Jean 3:3", "Jean 3:16", "Jean 4:24", "Jean 6:35", "Jean 8:12",
    "Jean 8:32", "Jean 10:10", "Jean 10:11", "Jean 11:25", "Jean 13:34", "Jean 13:35",
    "Jean 14:1", "Jean 14:6", "Jean 14:27", "Jean 15:5", "Jean 15:13", "Jean 16:33", "Jean 20:29",
    "Actes 1:8", "Actes 2:38", "Actes 4:12", "Actes 16:31", "Actes 20:35", "Romains 1:16",
    "Romains 3:23", "Romains 5:1", "Romains 5:8", "Romains 6:23", "Romains 8:1", "Romains 8:28",
    "Romains 8:31", "Romains 8:38", "Romains 8:39", "Romains 10:9", "Romains 10:13",
    "Romains 12:1", "Romains 12:2", "Romains 15:13", "1 Corinthiens 10:13", "1 Corinthiens 10:31",
    "1 Corinthiens 13:4", "1 Corinthiens 13:13", "1 Corinthiens 15:57", "2 Corinthiens 5:7",
    "2 Corinthiens 5:17", "2 Corinthiens 9:7", "2 Corinthiens 12:9", "Galates 2:20", "Galates 5:1",
    "Galates 5:22", "Galates 5:23", "Galates 6:9", "Éphésiens 2:8", "Éphésiens 2:9",
    "Éphésiens 2:10", "Éphésiens 4:32", "Éphésiens 5:25", "Éphésiens 6:10", "Éphésiens 6:11",
    "Philippiens 1:6", "Philippiens 1:21", "Philippiens 2:3", "Philippiens 3:14", "Philippiens 4:4",
    "Philippiens 4:6", "Philippiens 4:7", "Philippiens 4:8", "Philippiens 4:13", "Philippiens 4:19",
    "Colossiens 3:2", "Colossiens 3:15", "Colossiens 3:23", "1 Thessaloniciens 5:16",
    "1 Thessaloniciens 5:17", "1 Thessaloniciens 5:18", "2 Thessaloniciens 3:3",
    "1 Timothée 4:12", "2 Timothée 1:7", "2 Timothée 3:16", "2 Timothée 4:7", "Tite 2:11",
    "Hébreux 4:12", "Hébreux 4:16", "Hébreux 11:1", "Hébreux 11:6", "Hébreux 12:1", "Hébreux 13:5",
    "Hébreux 13:8", "Jacques 1:2", "Jacques 1:5", "Jacques 1:17", "Jacques 1:22", "Jacques 4:7",
    "Jacques 4:8", "1 Pierre 1:3", "1 Pierre 2:9", "1 Pierre 3:15", "1 Pierre 4:8", "1 Pierre 5:7",
    "2 Pierre 1:3", "2 Pierre 3:9", "1 Jean 1:9", "1 Jean 3:1", "1 Jean 4:7", "1 Jean 4:8",
    "1 Jean 4:18", "1 Jean 4:19", "1 Jean 5:4", "Apocalypse 1:8", "Apocalypse 3:20",
    "Apocalypse 21:4", "Apocalypse 22:13",
  ].map(normalizeReference)
);

function isPopularReference(reference: string | undefined): boolean {
  return Boolean(reference) && POPULAR_VERSE_REFERENCES.has(normalizeReference(reference as string));
}

/** Ramène une valeur 1-100 dans une bande [min, max] en préservant l'ordre
 * relatif (utilisé pour répartir facile/moyen à partir du classement par
 * longueur, sans jamais sortir de la bande visée). */
function scaleIntoBand(value: number, min: number, max: number): number {
  const ratio = (value - 1) / (MAX_LEVEL - 1);
  return Math.round(min + ratio * (max - min));
}

/** Niveau (1 à 100) déduit de la popularité et du contenu du texte, pour un
 * verset sans niveau explicite (ajout/import sans le préciser) :
 * - verset très connu (POPULAR_VERSE_REFERENCES) → facile, quelle que soit
 *   sa longueur ;
 * - liste de noms / généalogie / formule d'attribution de parole → difficile,
 *   car impossible à relier à une référence précise ;
 * - sinon → moyen, la longueur ne servant plus qu'à varier l'intérieur de
 *   cette bande (elle n'est plus le signe d'une difficulté réelle).
 */
export function getVerseLevelFromText(text: string, reference?: string): number {
  const length = text.length;
  const index = LEVEL_LENGTH_BREAKPOINTS.findIndex((max) => length <= max);
  const lengthRank = index === -1 ? MAX_LEVEL : index + 1;

  if (isPopularReference(reference)) {
    return Math.max(1, scaleIntoBand(lengthRank, 1, EASY_BAND_MAX));
  }

  if (
    length < HARD_OVERRIDE_MAX_LENGTH &&
    (FORMULAIC_SPEECH_PATTERN.test(text) || GENEALOGY_PATTERN.test(text) || hasObscureNameDensity(text))
  ) {
    return HARD_OVERRIDE_LEVEL;
  }

  return scaleIntoBand(lengthRank, MEDIUM_BAND_MIN, MEDIUM_BAND_MAX);
}

/** Compatibilité avec l'ancien champ à 3 paliers (easy/medium/hard),
 * toujours accepté en import, converti en un niveau représentatif. */
const LEGACY_DIFFICULTY_LEVEL: Record<string, number> = {
  easy: 15,
  medium: 50,
  hard: 85,
};

export function resolveVerseLevel(raw: unknown, text: string, reference?: string): number {
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
  return getVerseLevelFromText(text, reference);
}
