import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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
  const body = await request.json();
  const { deviceKey, name, parish, email, whatsapp } = body ?? {};

  if (!deviceKey || !name || !parish) {
    return NextResponse.json(
      { error: "deviceKey, name et parish sont requis" },
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
        parish,
        email: email || null,
        whatsapp: whatsapp || null,
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
