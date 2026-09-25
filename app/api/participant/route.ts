import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import { getClientIp, isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";

const RATE_LIMIT_ROUTE = "participant";
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MINUTES = 15;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  if (!deviceKey) {
    return NextResponse.json({ error: "deviceKey requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}

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

  const body = await request.json();
  const { deviceKey, name, address, email, whatsapp, showInLeaderboard } = body ?? {};

  if (!deviceKey || !name || !address || !email) {
    return NextResponse.json(
      { error: "deviceKey, name, address et email sont requis" },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Le format de l'email n'est pas valide." }, { status: 400 });
  }

  if (whatsapp && !isValidWhatsappValue(whatsapp)) {
    return NextResponse.json(
      { error: "Le format du numéro WhatsApp n'est pas valide." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("participants")
    .upsert(
      {
        device_key: deviceKey,
        name,
        address,
        email: email || null,
        whatsapp: whatsapp || null,
        show_in_leaderboard: Boolean(showInLeaderboard),
      },
      { onConflict: "device_key" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}
