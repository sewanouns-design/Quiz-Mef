import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";

  if (!token) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("participant_login_tokens")
    .select("id, participant_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }
  if (!tokenRow) {
    return NextResponse.json({ error: "Ce lien n'est plus valide." }, { status: 404 });
  }
  if (tokenRow.used_at) {
    return NextResponse.json(
      { error: "Ce lien a déjà été utilisé. Demandes-en un nouveau si besoin." },
      { status: 410 }
    );
  }
  if (new Date(tokenRow.expires_at) <= new Date()) {
    return NextResponse.json(
      { error: "Ce lien a expiré. Demandes-en un nouveau." },
      { status: 410 }
    );
  }

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("device_key, name, address, email, whatsapp, show_in_leaderboard")
    .eq("id", tokenRow.participant_id)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  // Jeton à usage unique : marqué consommé dès cette lecture réussie, même
  // si l'appel échoue ensuite côté client — il ne doit jamais pouvoir
  // resservir.
  await supabase
    .from("participant_login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({
    participant: {
      deviceKey: participant.device_key,
      name: participant.name,
      address: participant.address,
      email: participant.email ?? "",
      whatsapp: participant.whatsapp ?? "",
      showInLeaderboard: Boolean(participant.show_in_leaderboard),
    },
  });
}
