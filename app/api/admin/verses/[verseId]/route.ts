import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { resolveVerseLevel } from "@/lib/verse-level";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { verseId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("bible_verses")
    .select("text")
    .eq("id", params.verseId)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Verset introuvable" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body?.reference === "string") {
    const reference = body.reference.trim();
    if (!reference || reference.length > MAX_REFERENCE_LENGTH) {
      return NextResponse.json({ error: "Référence invalide." }, { status: 400 });
    }
    updates.reference = reference;
  }
  if (typeof body?.text === "string") {
    const text = body.text.trim();
    if (!text || text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Texte invalide." }, { status: 400 });
    }
    updates.text = text;
  }
  if (body?.blankWord !== undefined) {
    const blankWord = typeof body.blankWord === "string" ? body.blankWord.trim() : "";
    const textToCheck = (updates.text as string | undefined) ?? existing.text;
    if (blankWord && !textToCheck.includes(blankWord)) {
      return NextResponse.json(
        { error: "Le mot à deviner doit apparaître exactement tel quel dans le texte du verset." },
        { status: 400 }
      );
    }
    updates.blank_word = blankWord || null;
  }
  if (body?.level !== undefined) {
    const textToCheck = (updates.text as string | undefined) ?? existing.text;
    updates.level = resolveVerseLevel(body.level, textToCheck);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bible_verses")
    .update(updates)
    .eq("id", params.verseId)
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
