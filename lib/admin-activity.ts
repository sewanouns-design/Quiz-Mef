import { getSupabaseAdmin } from "./supabase";

export type AdminActivityAction =
  | "submissions_deleted"
  | "participants_deleted"
  | "participants_merged"
  | "quiz_created"
  | "quiz_updated"
  | "quiz_deleted"
  | "quiz_activated"
  | "quiz_deactivated"
  | "quiz_regraded"
  | "settings_updated";

/**
 * Journalise une action du super-admin dans admin_activity_log, affichée
 * ensuite mêlée aux soumissions dans "Activité récente" (Vue d'ensemble).
 * Best-effort : une erreur d'écriture ne doit jamais faire échouer l'action
 * admin elle-même (suppression, fusion...), seulement être logguée côté serveur.
 */
export async function logAdminActivity(
  action: AdminActivityAction,
  summary: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("admin_activity_log")
      .insert({ action, summary, metadata: metadata ?? null });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Erreur lors de la journalisation d'activité admin :", err);
  }
}
