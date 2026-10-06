import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { isValidEmail, isValidName, normalizeEmail } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/rate-limit";
import { mergeParticipants } from "@/lib/participant-merge";

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
  if (await checkAndRecordRateLimit(ip, RATE_LIMIT_ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { deviceKey, name, address, email, whatsapp, showInLeaderboard } = body ?? {};

  if (!deviceKey || !name || !email) {
    return NextResponse.json(
      { error: "deviceKey, name et email sont requis" },
      { status: 400 }
    );
  }

  const trimmedName = String(name).trim();
  if (!isValidName(trimmedName)) {
    return NextResponse.json(
      { error: "Merci d'indiquer ton vrai nom (lettres uniquement, pas de chiffres ni de symboles)." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Le format de l'email n'est pas valide." }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(email);

  if (whatsapp && !isValidWhatsappValue(whatsapp)) {
    return NextResponse.json(
      { error: "Le format du numéro WhatsApp n'est pas valide." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // L'email est l'identifiant principal d'une personne : si cet email est
  // déjà connu (sur un autre appareil que celui-ci), on rattache cet
  // appareil à la fiche existante au lieu de créer un doublon — ce qui
  // uniformise au passage le nom affiché partout (historique, classement...).
  const [{ data: byDevice, error: byDeviceError }, { data: byEmail, error: byEmailError }] =
    await Promise.all([
      supabase.from("participants").select("id").eq("device_key", deviceKey).maybeSingle(),
      supabase.from("participants").select("id").eq("email", normalizedEmail).maybeSingle(),
    ]);

  if (byDeviceError) return NextResponse.json({ error: byDeviceError.message }, { status: 500 });
  if (byEmailError) return NextResponse.json({ error: byEmailError.message }, { status: 500 });

  let targetId: string | null = byEmail?.id ?? byDevice?.id ?? null;

  if (byDevice && byEmail && byDevice.id !== byEmail.id) {
    try {
      await mergeParticipants(supabase, byEmail.id, [byDevice.id]);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur lors de la fusion du profil." },
        { status: 500 }
      );
    }
    targetId = byEmail.id;
  }

  const fields = {
    device_key: deviceKey,
    name: trimmedName,
    address: address || null,
    email: normalizedEmail,
    whatsapp: whatsapp || null,
    show_in_leaderboard: Boolean(showInLeaderboard),
  };

  const { data, error } = targetId
    ? await supabase.from("participants").update(fields).eq("id", targetId).select().single()
    : await supabase.from("participants").insert(fields).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ participant: data });
}
