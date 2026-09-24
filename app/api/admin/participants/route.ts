import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ participants: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids (tableau de chaînes non vide) requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // participants n'a pas de suppression en cascade depuis daily_submissions
  // ni lesson_questions (contrairement aux quiz) : on nettoie explicitement
  // avant de supprimer les fiches participant elles-mêmes.
  const { error: submissionsError } = await supabase
    .from("daily_submissions")
    .delete()
    .in("participant_id", ids);
  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const { error: lessonQuestionsError } = await supabase
    .from("lesson_questions")
    .delete()
    .in("participant_id", ids);
  if (lessonQuestionsError) {
    return NextResponse.json({ error: lessonQuestionsError.message }, { status: 500 });
  }

  const { error: participantsError } = await supabase.from("participants").delete().in("id", ids);
  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}
