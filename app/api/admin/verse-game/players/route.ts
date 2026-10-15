import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

interface ProgressRow {
  device_key: string;
  current_level: number;
  total_points: number;
  updated_at: string;
}

interface LegacyScoreRow {
  device_key: string;
  best_score: number;
  games_played: number;
  updated_at: string;
}

/**
 * Liste tous les joueurs du jeu, y compris les appareils créés par l'ancienne
 * version qui n'existaient que dans verse_game_scores. L'admin voit toujours
 * les données d'identité disponibles côté serveur.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const pageParam = Number(request.nextUrl.searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

  const supabase = getSupabaseAdmin();
  const [progressResult, legacyResult] = await Promise.all([
    supabase.from("verse_game_progress").select("device_key, current_level, total_points, updated_at"),
    supabase.from("verse_game_scores").select("device_key, best_score, games_played, updated_at"),
  ]);

  if (progressResult.error) return NextResponse.json({ error: progressResult.error.message }, { status: 500 });
  if (legacyResult.error) return NextResponse.json({ error: legacyResult.error.message }, { status: 500 });

  const progressRows = (progressResult.data ?? []) as ProgressRow[];
  const legacyRows = (legacyResult.data ?? []) as LegacyScoreRow[];
  const deviceKeys = [...new Set([
    ...progressRows.map((row) => row.device_key),
    ...legacyRows.map((row) => row.device_key),
  ])];

  const { data: participants, error: participantsError } = deviceKeys.length > 0
    ? await supabase.from("participants").select("device_key, name, email").in("device_key", deviceKeys)
    : { data: [], error: null };
  if (participantsError) return NextResponse.json({ error: participantsError.message }, { status: 500 });

  const participantByDevice = new Map((participants ?? []).map((participant) => [participant.device_key, participant]));
  const progressByDevice = new Map(progressRows.map((row) => [row.device_key, row]));
  const legacyByDevice = new Map(legacyRows.map((row) => [row.device_key, row]));

  const merged = deviceKeys.map((deviceKey) => {
    const progress = progressByDevice.get(deviceKey);
    const legacy = legacyByDevice.get(deviceKey);
    const updatedAt = [progress?.updated_at, legacy?.updated_at].filter(Boolean).sort().at(-1) ?? new Date(0).toISOString();
    return {
      deviceKey,
      currentLevel: progress?.current_level ?? 1,
      totalPoints: progress?.total_points ?? legacy?.best_score ?? 0,
      updatedAt,
      name: participantByDevice.get(deviceKey)?.name ?? null,
      email: participantByDevice.get(deviceKey)?.email ?? null,
      legacyOnly: !progress && Boolean(legacy),
      legacyBestScore: legacy?.best_score ?? null,
      legacyGamesPlayed: legacy?.games_played ?? null,
    };
  }).filter((player) => {
    if (!search) return true;
    return [player.deviceKey, player.name, player.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  }).sort((a, b) => b.totalPoints - a.totalPoints || b.updatedAt.localeCompare(a.updatedAt));

  const from = (page - 1) * limit;
  return NextResponse.json({
    players: merged.slice(from, from + limit),
    total: merged.length,
    page,
    limit,
  });
}
