import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Suggestions envoyées par ce participant (identifié par deviceKey), avec
 * le statut "pris en compte" et l'éventuelle réponse de l'admin — affichées
 * sur la page de résultats pour que la personne sache que son retour a été
 * lu, même sans réponse écrite.
 */
export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  if (!deviceKey) {
    return NextResponse.json({ error: "deviceKey requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ suggestions: [] });
  }

  const { data, error } = await supabase
    .from("suggestions")
    .select("id, message, acknowledged, admin_response, responded_at, created_at")
    .eq("participant_id", participant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestions: data ?? [] });
}
