import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";
import { MAX_LEVEL } from "@/lib/verse-level";
import { isValidName } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Modifie la progression et/ou le nom public d'un joueur, ancien ou récent. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deviceKey: string }> }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const { deviceKey } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  let requestedName: string | undefined;

  if (body?.name !== undefined) {
    if (typeof body.name !== "string") return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    const candidateName = body.name.trim();
    if (!isValidName(candidateName)) {
      return NextResponse.json({ error: "Merci d'indiquer un nom réel, composé de lettres et d'espaces." }, { status: 400 });
    }
    requestedName = candidateName;
  }

  if (body?.currentLevel !== undefined) {
    const level = Number(body.currentLevel);
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      return NextResponse.json({ error: `Niveau invalide (1 à ${MAX_LEVEL}).` }, { status: 400 });
    }
    updates.current_level = level;
  }
  if (body?.totalPoints !== undefined) {
    const points = Number(body.totalPoints);
    if (!Number.isInteger(points) || points < 0) return NextResponse.json({ error: "Points invalides." }, { status: 400 });
    updates.total_points = points;
  }
  if (Object.keys(updates).length === 0 && requestedName === undefined) {
    return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const [{ data: progress, error: progressError }, { data: legacy, error: legacyError }] = await Promise.all([
    supabase.from("verse_game_progress").select("*").eq("device_key", deviceKey).maybeSingle(),
    supabase.from("verse_game_scores").select("best_score, games_played, updated_at").eq("device_key", deviceKey).maybeSingle(),
  ]);
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 500 });
  if (legacyError) return NextResponse.json({ error: legacyError.message }, { status: 500 });
  if (!progress && !legacy) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  let savedProgress = progress;
  if (Object.keys(updates).length > 0) {
    const progressPayload = {
      device_key: deviceKey,
      current_level: Number(updates.current_level ?? progress?.current_level ?? 1),
      total_points: Number(updates.total_points ?? progress?.total_points ?? legacy?.best_score ?? 0),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("verse_game_progress")
      .upsert(progressPayload, { onConflict: "device_key" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    savedProgress = data;
  }

  let currentName: string | null = null;
  const { data: existingParticipant, error: participantLookupError } = await supabase
    .from("participants")
    .select("id, name")
    .eq("device_key", deviceKey)
    .maybeSingle();
  if (participantLookupError) return NextResponse.json({ error: participantLookupError.message }, { status: 500 });
  currentName = existingParticipant?.name ?? null;

  if (requestedName !== undefined) {
    const participantWrite = existingParticipant
      ? await supabase.from("participants").update({ name: requestedName, show_in_leaderboard: true }).eq("id", existingParticipant.id)
      : await supabase.from("participants").insert({ device_key: deviceKey, name: requestedName, email: null, show_in_leaderboard: true });
    if (participantWrite.error) return NextResponse.json({ error: participantWrite.error.message }, { status: 500 });
    currentName = requestedName;
  }

  await logAdminActivity(
    "verse_game_player_updated",
    requestedName !== undefined
      ? `Joueur ${deviceKey} renommé « ${requestedName} » ; progression : niveau ${savedProgress?.current_level ?? 1}, ${savedProgress?.total_points ?? legacy?.best_score ?? 0} points.`
      : `Progression modifiée pour ${deviceKey} : niveau ${savedProgress?.current_level ?? 1}, ${savedProgress?.total_points ?? 0} points.`
  );

  return NextResponse.json({
    player: {
      ...(savedProgress ?? { device_key: deviceKey, current_level: 1, total_points: legacy?.best_score ?? 0 }),
      name: currentName,
    },
  });
}

/** Réinitialise la progression récente et l'ancien meilleur score du joueur. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceKey: string }> }
) {
  if (!isAdminRequestAuthenticated(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });

  const { deviceKey } = await params;
  const supabase = getSupabaseAdmin();
  const [progressResult, legacyResult] = await Promise.all([
    supabase.from("verse_game_progress").delete().eq("device_key", deviceKey),
    supabase.from("verse_game_scores").delete().eq("device_key", deviceKey),
  ]);
  if (progressResult.error) return NextResponse.json({ error: progressResult.error.message }, { status: 500 });
  if (legacyResult.error) return NextResponse.json({ error: legacyResult.error.message }, { status: 500 });

  await logAdminActivity("verse_game_player_reset", `Progression réinitialisée pour ${deviceKey}.`);
  return NextResponse.json({ ok: true });
}
