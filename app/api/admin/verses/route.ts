import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bible_verses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verses: data ?? [] });
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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bible_verses")
    .insert({ reference, text, blank_word: blankWord || null })
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
