import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatLeaderboardName } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 20;
// Fenêtre maximale même sans paramètre `since` (premier appel) : pas la
// peine de remonter plus loin pour une notification "en direct".
const DEFAULT_LOOKBACK_MS = 15_000;

/**
 * Fil des niveaux débloqués récemment, pour les notifications flottantes du
 * jeu (façon likes de live) — jamais pour les simples points gagnés, juste
 * les passages de niveau, et seulement pour les participants ayant activé
 * "Afficher mon prénom dans le classement" (sinon l'évènement est ignoré :
 * pas de notification anonyme, comme pour le classement).
 */
export async function GET(request: NextRequest) {
  const sinceParam = request.nextUrl.searchParams.get("since");
  const since =
    sinceParam && !Number.isNaN(Date.parse(sinceParam))
      ? sinceParam
      : new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();

  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from("verse_game_activity")
    .select("id, device_key, level, created_at")
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_EVENTS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = events ?? [];
  const deviceKeys = [...new Set(rows.map((e) => e.device_key))];

  const { data: participants, error: participantsError } =
    deviceKeys.length > 0
      ? await supabase
          .from("participants")
          .select("device_key, name, show_in_leaderboard")
          .in("device_key", deviceKeys)
      : { data: [], error: null };
  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  const participantByDevice = new Map((participants ?? []).map((p) => [p.device_key, p]));

  const items = rows
    .filter((e) => participantByDevice.get(e.device_key)?.show_in_leaderboard)
    .map((e) => ({
      id: e.id,
      displayName: formatLeaderboardName(participantByDevice.get(e.device_key)!.name),
      level: e.level,
      createdAt: e.created_at,
    }));

  const latest = rows.length > 0 ? rows[rows.length - 1].created_at : since;

  return NextResponse.json({ events: items, latest });
}
