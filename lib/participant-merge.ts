import type { getSupabaseAdmin } from "./supabase";

export interface MergeResult {
  reassigned: number;
  deletedDuplicates: number;
}

/**
 * Fusionne une ou plusieurs fiches participant "source" dans une fiche
 * "cible" : réattribue leurs soumissions, questions de leçon et
 * suggestions, puis supprime les fiches source. Utilisé par la fusion
 * manuelle (admin) et par l'identification automatique par email (un même
 * email détecté sur un nouvel appareil fusionne l'ancienne fiche dans la
 * fiche déjà connue plutôt que de créer un doublon).
 */
export async function mergeParticipants(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  targetId: string,
  sourceIds: string[]
): Promise<MergeResult> {
  const { data: sourceSubmissions, error: fetchError } = await supabase
    .from("daily_submissions")
    .select("id")
    .in("participant_id", sourceIds);

  if (fetchError) throw new Error(fetchError.message);

  let reassigned = 0;
  let deletedDuplicates = 0;

  // Réattribue chaque soumission une par une. Si la fiche cible a déjà une
  // soumission pour le même quiz + tentative (contrainte d'unicité), on ne
  // peut pas avoir les deux : on supprime le doublon plutôt que de faire
  // échouer toute la fusion.
  for (const sub of sourceSubmissions ?? []) {
    const { error: updateError } = await supabase
      .from("daily_submissions")
      .update({ participant_id: targetId })
      .eq("id", sub.id);

    if (updateError) {
      if (updateError.code === "23505") {
        const { error: deleteError } = await supabase
          .from("daily_submissions")
          .delete()
          .eq("id", sub.id);
        if (deleteError) throw new Error(deleteError.message);
        deletedDuplicates += 1;
        continue;
      }
      throw new Error(updateError.message);
    }
    reassigned += 1;
  }

  const { error: lessonQuestionsError } = await supabase
    .from("lesson_questions")
    .update({ participant_id: targetId })
    .in("participant_id", sourceIds);
  if (lessonQuestionsError) throw new Error(lessonQuestionsError.message);

  const { error: suggestionsError } = await supabase
    .from("suggestions")
    .update({ participant_id: targetId })
    .in("participant_id", sourceIds);
  if (suggestionsError) throw new Error(suggestionsError.message);

  const { error: deleteParticipantsError } = await supabase
    .from("participants")
    .delete()
    .in("id", sourceIds);
  if (deleteParticipantsError) throw new Error(deleteParticipantsError.message);

  return { reassigned, deletedDuplicates };
}
