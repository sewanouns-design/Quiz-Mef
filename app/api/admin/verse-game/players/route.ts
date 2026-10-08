import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Liste paginée (et cherchable par nom/email) de tous les joueurs de
 * "Trouve le verset", avec leur progression. Contrairement au classement
 * public, l'admin voit toujours le nom complet et l'email, sans condition
 * d'opt-in — c'est une vue de gestion, pas un affichage public.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const pageParam = Number(request.nextUrl.searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  const supabase = getSupabaseAdmin();

  let deviceKeyFilter: string[] | null = null;
  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    const { data: matches, error: matchError } = await supabase
      .from("participants")
      .select("device_key")
      .or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }
    deviceKeyFilter = (matches ?? []).map((p) => p.device_key);
    if (deviceKeyFilter.length === 0) {
      return NextResponse.json({ players: [], total: 0, page, limit });
    }
  }

  let query = supabase.from("verse_game_progress").select("*", { count: "exact" });
  if (deviceKeyFilter) {
    query = query.in("device_key", deviceKeyFilter);
  }

  const from = (page - 1) * limit;
  const { data: progress, error, count } = await query
    .order("total_points", { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = progress ?? [];
  const deviceKeys = rows.map((r) => r.device_key);

  const { data: participants, error: participantsError } =
    deviceKeys.length > 0
      ? await supabase
          .from("participants")
          .select("device_key, name, email, show_in_leaderboard")
          .in("device_key", deviceKeys)
      : { data: [], error: null };
  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  const participantByDevice = new Map((participants ?? []).map((p) => [p.device_key, p]));

  const players = rows.map((r) => {
    const participant = participantByDevice.get(r.device_key);
    return {
      deviceKey: r.device_key,
      currentLevel: r.current_level,
      totalPoints: r.total_points,
      updatedAt: r.updated_at,
      name: participant?.name ?? null,
      email: participant?.email ?? null,
      showInLeaderboard: participant?.show_in_leaderboard ?? false,
    };
  });

  return NextResponse.json({ players, total: count ?? 0, page, limit });
}
