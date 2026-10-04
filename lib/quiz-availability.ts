/**
 * Clause Supabase `.or(...)` pour filtrer les quiz dont l'échéance
 * (expires_at) n'est pas encore passée — ou qui n'en ont pas. Un quiz actif
 * mais échu n'est plus "découvrable" par les participants (page d'accueil,
 * sélecteur de quiz) même si is_active reste à true côté admin ; un lien
 * déjà obtenu vers ce quiz continue de fonctionner (voir GET /api/quiz/[quizId]).
 */
export function notExpiredClause(): string {
  return `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
}
