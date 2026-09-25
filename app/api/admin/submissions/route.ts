import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

function summarizeNames(names: string[], total: number): string {
  const shown = names.slice(0, 3).join(", ");
  const rest = total - Math.min(3, names.length);
  return rest > 0 ? `${shown} et ${rest} autre${rest > 1 ? "s" : ""}` : shown;
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

  // Capturé avant suppression, pour un journal d'activité lisible (le
  // participant/quiz ne sera plus interrogeable une fois la ligne supprimée).
  const { data: toDelete } = await supabase
    .from("daily_submissions")
    .select("score, max_score, participant:participants(name), quiz:daily_quizzes(title)")
    .in("id", ids);

  // daily_answers.submission_id a "on delete cascade" : les réponses liées
  // sont supprimées automatiquement.
  const { error } = await supabase.from("daily_submissions").delete().in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const names = (toDelete ?? []).map(
    (s) => (s.participant as unknown as { name: string } | null)?.name ?? "?"
  );
  await logAdminActivity(
    "submissions_deleted",
    `${ids.length} résultat${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}${
      names.length > 0 ? ` (${summarizeNames(names, ids.length)})` : ""
    }`,
    { count: ids.length, ids }
  );

  return NextResponse.json({ ok: true, deleted: ids.length });
}
