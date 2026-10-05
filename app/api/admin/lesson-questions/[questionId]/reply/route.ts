import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Réponse de l'admin à une question sur la leçon. Affichée côté
 * participant comme venant d'« Un admin », jamais du nom personnel de qui
 * a répondu.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Le message ne peut pas être vide." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: question } = await supabase
    .from("lesson_questions")
    .select("id")
    .eq("id", params.questionId)
    .maybeSingle();

  if (!question) {
    return NextResponse.json({ error: "Question introuvable." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("lesson_question_replies")
    .insert({
      lesson_question_id: params.questionId,
      sender: "admin",
      message: message.slice(0, MAX_MESSAGE_LENGTH),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reply: data });
}
