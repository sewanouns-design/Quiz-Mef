import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT_ROUTE = "lesson-question-reply";
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * Relance du participant sur le fil d'une question qu'il a posée, affichée
 * sur sa page de résultats. Seul l'auteur de la question (même participant,
 * identifié par deviceKey) peut y répondre.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string; questionId: string } }
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (await checkAndRecordRateLimit(ip, RATE_LIMIT_ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { deviceKey, message } = body ?? {};
  const trimmed = typeof message === "string" ? message.trim() : "";

  if (!deviceKey || !trimmed) {
    return NextResponse.json({ error: "deviceKey et message sont requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
  }

  const { data: question } = await supabase
    .from("lesson_questions")
    .select("id, participant_id, quiz_id")
    .eq("id", params.questionId)
    .maybeSingle();

  if (
    !question ||
    question.quiz_id !== params.quizId ||
    question.participant_id !== participant.id
  ) {
    return NextResponse.json({ error: "Question introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("lesson_question_replies")
    .insert({
      lesson_question_id: params.questionId,
      sender: "participant",
      message: trimmed.slice(0, MAX_MESSAGE_LENGTH),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reply: data });
}
