import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MAX_LEVEL } from "@/lib/verse-level";

export const dynamic = "force-dynamic";

/**
 * Progression d'un appareil dans "Trouve le verset" (niveau débloqué,
 * points cumulés). Créée à la première consultation si elle n'existe pas
 * encore — jouer ne nécessite aucune identification, deviceKey suffit.
 */
export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey")?.trim();
  if (!deviceKey) {
    return NextResponse.json({ error: "deviceKey requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await supabase
    .from("verse_game_progress")
    .select("current_level, total_points")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({
      currentLevel: existing.current_level,
      totalPoints: existing.total_points,
      maxLevel: MAX_LEVEL,
    });
  }

  const { data: created, error: insertError } = await supabase
    .from("verse_game_progress")
    .insert({ device_key: deviceKey })
    .select("current_level, total_points")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    currentLevel: created.current_level,
    totalPoints: created.total_points,
    maxLevel: MAX_LEVEL,
  });
}
