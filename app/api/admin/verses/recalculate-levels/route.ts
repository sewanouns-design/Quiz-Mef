import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_MIN_SAMPLES = 5;

/**
 * Recalcule le niveau des versets à partir du taux d'échec RÉEL des
 * joueurs (bible_verse_stats), pas de la longueur du texte : un verset
 * court mais souvent raté doit se retrouver à un niveau élevé, pas
 * "facile" juste parce qu'il est court. Seuls les versets ayant assez de
 * réponses enregistrées sont reclassés ; les autres gardent leur niveau
 * actuel en attendant d'avoir assez de données.
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const minSamplesRaw = Number(body?.minSamples);
  const minSamples =
    Number.isInteger(minSamplesRaw) && minSamplesRaw > 0 ? minSamplesRaw : DEFAULT_MIN_SAMPLES;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("recalculate_verse_levels_by_difficulty", {
    min_samples: minSamples,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data ?? 0, minSamples });
}
