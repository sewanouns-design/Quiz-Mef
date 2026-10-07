import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;
const MAX_ITEMS = 300;

interface RawVerseItem {
  reference?: unknown;
  text?: unknown;
  blankWord?: unknown;
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body?.verses) ? (body.verses as RawVerseItem[]) : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "Aucun verset à importer." }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Trop de versets à la fois (max ${MAX_ITEMS}).` }, { status: 400 });
  }

  const rows: { reference: string; text: string; blank_word: string | null }[] = [];
  const rejected: { line: number; reason: string }[] = [];

  items.forEach((item, index) => {
    const reference = typeof item.reference === "string" ? item.reference.trim() : "";
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const blankWord = typeof item.blankWord === "string" ? item.blankWord.trim() : "";

    if (!reference || !text) {
      rejected.push({ line: index + 1, reason: "référence ou texte manquant" });
      return;
    }
    if (reference.length > MAX_REFERENCE_LENGTH || text.length > MAX_TEXT_LENGTH) {
      rejected.push({ line: index + 1, reason: "référence ou texte trop long" });
      return;
    }
    if (blankWord && !text.includes(blankWord)) {
      rejected.push({ line: index + 1, reason: "le mot à deviner n'apparaît pas dans le texte" });
      return;
    }
    rows.push({ reference, text, blank_word: blankWord || null });
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucun verset valide à importer.", rejected }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bible_verses")
    .upsert(rows, { onConflict: "reference", ignoreDuplicates: false })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verses: data ?? [], imported: data?.length ?? 0, rejected });
}
