import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { targetId, sourceIds, fields } = body ?? {};

  if (
    typeof targetId !== "string" ||
    !Array.isArray(sourceIds) ||
    sourceIds.length === 0 ||
    !sourceIds.every((id) => typeof id === "string") ||
    sourceIds.includes(targetId)
  ) {
    return NextResponse.json(
      { error: "targetId et sourceIds (sans doublon avec targetId) sont requis" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: sourceSubmissions, error: fetchError } = await supabase
    .from("daily_submissions")
    .select("id")
    .in("participant_id", sourceIds);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let reassigned = 0;
  let deletedDuplicates = 0;

  // Réattribue chaque soumission des fiches fusionnées vers la fiche
  // principale, une par une. Si la fiche principale a déjà une soumission
  // pour le même quiz + tentative (contrainte d'unicité), on ne peut pas
  // avoir les deux : on supprime le doublon plutôt que de faire échouer
  // toute la fusion.
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
        if (deleteError) {
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }
        deletedDuplicates += 1;
        continue;
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    reassigned += 1;
  }

  const { error: lessonQuestionsError } = await supabase
    .from("lesson_questions")
    .update({ participant_id: targetId })
    .in("participant_id", sourceIds);

  if (lessonQuestionsError) {
    return NextResponse.json({ error: lessonQuestionsError.message }, { status: 500 });
  }

  const { error: deleteParticipantsError } = await supabase
    .from("participants")
    .delete()
    .in("id", sourceIds);

  if (deleteParticipantsError) {
    return NextResponse.json({ error: deleteParticipantsError.message }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof fields?.name === "string" && fields.name.trim()) updates.name = fields.name.trim();
  if (typeof fields?.parish === "string" && fields.parish.trim()) updates.parish = fields.parish.trim();
  if (fields?.email !== undefined) updates.email = fields.email || null;
  if (fields?.whatsapp !== undefined) updates.whatsapp = fields.whatsapp || null;

  let target = null;
  if (Object.keys(updates).length > 0) {
    const { data, error: targetError } = await supabase
      .from("participants")
      .update(updates)
      .eq("id", targetId)
      .select()
      .single();
    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }
    target = data;
  }

  return NextResponse.json({ ok: true, participant: target, reassigned, deletedDuplicates });
}
