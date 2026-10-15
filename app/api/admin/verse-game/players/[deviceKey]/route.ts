import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";
import { MAX_LEVEL } from "@/lib/verse-level";
import { isValidName } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Modifie la progression et/ou le nom public d'un joueur. */
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
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    const candidateName = body.name.trim();
    if (!isValidName(candidateName)) {
      return NextResponse.json(
        { error: "Merci d'indiquer un nom réel, composé de lettres et d'espaces." },
        { status: 400 }
      );
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
    if (!Number.isInteger(points) || points < 0) {
      return NextResponse.json({ error: "Points invalides." }, { status: 400 });
    }
    updates.total_points = points;
  }

  if (Object.keys(updates).length === 0 && requestedName === undefined) {
    return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  let data: Record<string, unknown> | null = null;
  if (Object.keys(updates).length > 1) {
    const { data: progress, error } = await supabase
      .from("verse_game_progress")
      .update(updates)
      .eq("device_key", deviceKey)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!progress) {
      return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
    }
    data = progress as Record<string, unknown>;
  } else {
    const { data: progress, error } = await supabase
      .from("verse_game_progress")
      .select()
      .eq("device_key", deviceKey)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!progress) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
    data = progress as Record<string, unknown>;
  }

  if (requestedName !== undefined) {
    const { data: existingParticipant, error: participantLookupError } = await supabase
      .from("participants")
      .select("id")
      .eq("device_key", deviceKey)
      .maybeSingle();
    if (participantLookupError) {
      return NextResponse.json({ error: participantLookupError.message }, { status: 500 });
    }

    const participantWrite = existingParticipant
      ? await supabase
          .from("participants")
          .update({ name: requestedName, show_in_leaderboard: true })
          .eq("id", existingParticipant.id)
      : await supabase.from("participants").insert({
          device_key: deviceKey,
          name: requestedName,
          email: null,
          show_in_leaderboard: true,
        });
    if (participantWrite.error) {
      return NextResponse.json({ error: participantWrite.error.message }, { status: 500 });
    }
  }

  await logAdminActivity(
    "verse_game_player_updated",
    requestedName !== undefined
      ? `Joueur ${deviceKey} renommé « ${requestedName} » ; progression : niveau ${data.current_level}, ${data.total_points} points.`
      : `Progression modifiée pour ${deviceKey} : niveau ${data.current_level}, ${data.total_points} points.`
  );

  return NextResponse.json({
    player: requestedName !== undefined ? { ...data, name: requestedName } : data,
  });
}

/** Remet un joueur à zéro (niveau 1, 0 point) en supprimant sa ligne de
 * progression — elle est recréée automatiquement à sa prochaine partie. */
export async function DELETE(
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
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("verse_game_progress").delete().eq("device_key", deviceKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminActivity("verse_game_player_reset", `Progression réinitialisée pour ${deviceKey}.`);

  return NextResponse.json({ ok: true });
}
