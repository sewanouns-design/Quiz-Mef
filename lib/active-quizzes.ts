import { getSupabaseAdmin } from "./supabase";
import type { ActiveQuiz } from "./types";

/**
 * Tous les quiz actuellement actifs (plusieurs peuvent l'être en même temps),
 * du plus récent au plus ancien. Les quiz hebdomadaires sont mis en avant par
 * l'affichage, pas par cette requête.
 */
export async function fetchActiveQuizzes(): Promise<ActiveQuiz[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date, quiz_type")
    .eq("is_active", true)
    .order("lesson_date", { ascending: false });

  if (error) {
    console.error("Erreur récupération des quiz actifs :", error.message);
    return [];
  }
  return (data ?? []) as ActiveQuiz[];
}
