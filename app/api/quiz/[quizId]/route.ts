import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PublicQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const supabase = getSupabaseAdmin();
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");

  const { data: quiz, error: quizError } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date, is_active")
    .eq("id", params.quizId)
    .maybeSingle();

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  const { data: questions, error: questionsError } = await supabase
    .from("daily_questions")
    .select("id, quiz_id, type, question, options, points, position")
    .eq("quiz_id", params.quizId)
    .order("position", { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  let alreadySubmitted = false;
  if (deviceKey) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("device_key", deviceKey)
      .maybeSingle();

    if (participant) {
      const { data: submission } = await supabase
        .from("daily_submissions")
        .select("id")
        .eq("quiz_id", params.quizId)
        .eq("participant_id", participant.id)
        .maybeSingle();

      alreadySubmitted = Boolean(submission);
    }
  }

  return NextResponse.json({
    quiz,
    questions: (questions ?? []) as PublicQuestion[],
    alreadySubmitted,
  });
}
