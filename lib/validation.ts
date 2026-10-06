// Email volontairement strict : exige un domaine avec au moins deux
// niveaux (nom + extension alphabétique d'au moins 2 lettres), pour
// rejeter les saisies de test du type "a@b" ou "test@test".
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,63}$/;

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

/** Forme canonique d'un email (minuscules, sans espaces) utilisée pour toute comparaison/stockage. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Lettres (accentuées incluses) regroupées par espace/apostrophe/tiret/point,
// pour accepter "Jean-Baptiste", "N'Guessan", "D'Almeida"... sans accepter
// des chiffres ou du charabia.
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '.-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  if (!NAME_REGEX.test(trimmed)) return false;
  // Rejette les suites du type "aaaa" ou "ggggg" typiques d'une saisie de test.
  if (/(.)\1{3,}/i.test(trimmed)) return false;
  return true;
}
