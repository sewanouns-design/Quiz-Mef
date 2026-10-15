import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatLeaderboardName } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 20;

interface RankedPlayer {
  device_key: string;
  total_points: number;
  current_level: number;
}

/** Classement public unifié : progression récente + anciens meilleurs scores. */
export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  const supabase = getSupabaseAdmin();
  const [progressResult, legacyResult] = await Promise.all([
    supabase.from("verse_game_progress").select("device_key, total_points, current_level"),
    supabase.from("verse_game_scores").select("device_key, best_score"),
  ]);
  if (progressResult.error) return NextResponse.json({ error: progressResult.error.message }, { status: 500 });
  if (legacyResult.error) return NextResponse.json({ error: legacyResult.error.message }, { status: 500 });

  const progressByDevice = new Map((progressResult.data ?? []).map((row) => [row.device_key, row]));
  const legacyByDevice = new Map((legacyResult.data ?? []).map((row) => [row.device_key, row]));
  const deviceKeys = [...new Set([...progressByDevice.keys(), ...legacyByDevice.keys()])];
  const ranked: RankedPlayer[] = deviceKeys
    .map((key) => ({
      device_key: key,
      total_points: progressByDevice.get(key)?.total_points ?? legacyByDevice.get(key)?.best_score ?? 0,
      current_level: progressByDevice.get(key)?.current_level ?? 1,
    }))
    .sort((a, b) => b.total_points - a.total_points || a.device_key.localeCompare(b.device_key));

  const { data: participants, error: participantsError } = deviceKeys.length > 0
    ? await supabase.from("participants").select("device_key, name").in("device_key", deviceKeys)
    : { data: [], error: null };
  if (participantsError) return NextResponse.json({ error: participantsError.message }, { status: 500 });

  const participantByDevice = new Map((participants ?? []).map((participant) => [participant.device_key, participant]));
  const entries = ranked
    .filter((player) => participantByDevice.has(player.device_key))
    .slice(0, MAX_ENTRIES)
    .map((player) => ({
      displayName: formatLeaderboardName(participantByDevice.get(player.device_key)!.name),
      score: player.total_points,
      level: player.current_level,
    }));

  const index = deviceKey ? ranked.findIndex((player) => player.device_key === deviceKey) : -1;
  const mine = index >= 0 ? ranked[index] : null;
  return NextResponse.json({
    entries,
    totalPlayers: ranked.length,
    myRank: index >= 0 ? index + 1 : null,
    myScore: mine?.total_points ?? null,
    myLevel: mine?.current_level ?? null,
  });
}
