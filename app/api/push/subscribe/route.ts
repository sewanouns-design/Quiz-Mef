import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { deviceKey, endpoint, keys } = body ?? {};

  if (!deviceKey || !endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "deviceKey, endpoint et keys (p256dh, auth) sont requis" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      participant_id: participant.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { endpoint } = body ?? {};

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
