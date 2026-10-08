import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;
// Une seule requête peut contenir jusqu'à ce nombre de versets : le client
// (VersesTab) découpe lui-même un fichier plus volumineux en plusieurs
// requêtes successives de cette taille, pour rester bien en dessous des
// limites de taille de requête et de durée d'exécution de la plateforme,
// même pour une banque de plusieurs milliers de versets.
const MAX_ITEMS_PER_REQUEST = 1000;
// Taille des lots envoyés à Supabase à l'intérieur d'une même requête : un
// upsert portant sur trop de lignes à la fois peut dépasser les limites de
// la base, donc on le découpe aussi côté serveur.
const DB_CHUNK_SIZE = 200;
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

interface RawVerseItem {
  reference?: unknown;
  text?: unknown;
  blankWord?: unknown;
  difficulty?: unknown;
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
  if (items.length > MAX_ITEMS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Trop de versets dans une seule requête (max ${MAX_ITEMS_PER_REQUEST}).` },
      { status: 400 }
    );
  }

  const rows: {
    reference: string;
    text: string;
    blank_word: string | null;
    difficulty: string | null;
  }[] = [];
  const rejected: { line: number; reason: string }[] = [];
  const seenReferences = new Set<string>();

  items.forEach((item, index) => {
    const reference = typeof item.reference === "string" ? item.reference.trim() : "";
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const blankWord = typeof item.blankWord === "string" ? item.blankWord.trim() : "";
    const difficultyRaw = typeof item.difficulty === "string" ? item.difficulty.trim().toLowerCase() : "";
    const difficulty = VALID_DIFFICULTIES.includes(difficultyRaw) ? difficultyRaw : null;

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
    // Deux lignes avec la même référence dans le même lot : upsert refuserait
    // le lot entier ("ON CONFLICT DO UPDATE command cannot affect row a
    // second time"), donc on ne garde que la dernière occurrence.
    if (seenReferences.has(reference)) {
      rows[rows.findIndex((r) => r.reference === reference)] = {
        reference,
        text,
        blank_word: blankWord || null,
        difficulty,
      };
      return;
    }
    seenReferences.add(reference);
    rows.push({ reference, text, blank_word: blankWord || null, difficulty });
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucun verset valide à importer.", rejected }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let imported = 0;

  for (let i = 0; i < rows.length; i += DB_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + DB_CHUNK_SIZE);
    const { error, count } = await supabase
      .from("bible_verses")
      .upsert(chunk, { onConflict: "reference", ignoreDuplicates: false, count: "exact" });

    if (error) {
      return NextResponse.json(
        { error: error.message, imported, rejected },
        { status: 500 }
      );
    }
    imported += count ?? chunk.length;
  }

  return NextResponse.json({ imported, rejected });
}
