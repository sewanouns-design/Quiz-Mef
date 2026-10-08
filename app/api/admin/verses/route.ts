import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { resolveVerseLevel } from "@/lib/verse-level";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Liste paginée (et filtrable par référence/texte) plutôt qu'un chargement
 * complet : une banque peut compter plusieurs dizaines de milliers de
 * versets (ex. la Bible entière), bien au-delà de ce qu'une seule requête
 * Supabase renvoie par défaut (1000 lignes max) et de ce qu'il est
 * raisonnable d'afficher d'un coup dans l'admin.
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
  let query = supabase.from("bible_verses").select("*", { count: "exact" });
  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(`reference.ilike.%${escaped}%,text.ilike.%${escaped}%`);
  }

  const from = (page - 1) * limit;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verses: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const blankWord = typeof body?.blankWord === "string" ? body.blankWord.trim() : "";

  if (!reference || !text) {
    return NextResponse.json({ error: "La référence et le texte sont requis." }, { status: 400 });
  }
  if (reference.length > MAX_REFERENCE_LENGTH || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Référence ou texte trop long." }, { status: 400 });
  }
  if (blankWord && !text.includes(blankWord)) {
    return NextResponse.json(
      { error: "Le mot à deviner doit apparaître exactement tel quel dans le texte du verset." },
      { status: 400 }
    );
  }

  const level = resolveVerseLevel(body?.level, text, reference);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bible_verses")
    .insert({ reference, text, blank_word: blankWord || null, level })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Cette référence existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verse: data });
}

// Désactivée pour le moment (suppression accidentelle de versets) : on
// garde la route mais elle refuse toute suppression tant que ce n'est pas
// réactivé explicitement.
export async function DELETE(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "La suppression de versets est désactivée pour le moment." },
    { status: 403 }
  );
}
