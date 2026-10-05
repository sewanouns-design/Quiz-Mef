import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { getClientIp, isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_ROUTE = "suggestion";
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (await isRateLimited(ip, RATE_LIMIT_ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }
  await recordRateLimitEvent(ip, RATE_LIMIT_ROUTE);

  const body = await request.json().catch(() => ({}));
  const { deviceKey, message } = body ?? {};
  const trimmed = typeof message === "string" ? message.trim() : "";

  if (!deviceKey || !trimmed) {
    return NextResponse.json({ error: "deviceKey et message sont requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("suggestions").insert({
    participant_id: participant.id,
    message: trimmed.slice(0, MAX_MESSAGE_LENGTH),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
