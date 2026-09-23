import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { deviceKey, questionText } = body ?? {};

  if (!deviceKey || typeof questionText !== "string" || !questionText.trim()) {
    return NextResponse.json(
      { error: "deviceKey et questionText sont requis" },
      { status: 400 }
    );
  }

  const trimmed = questionText.trim().slice(0, MAX_QUESTION_LENGTH);

  const supabase = getSupabaseAdmin();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("lesson_questions").insert({
    quiz_id: params.quizId,
    participant_id: participant.id,
    question_text: trimmed,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
