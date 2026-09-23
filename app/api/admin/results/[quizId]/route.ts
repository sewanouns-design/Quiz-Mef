import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: quiz, error: quizError } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date")
    .eq("id", params.quizId)
    .maybeSingle();

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("daily_submissions")
    .select(
      "id, score, max_score, cancelled, submitted_at, participant:participants(id, name, parish, email, whatsapp)"
    )
    .eq("quiz_id", params.quizId)
    .order("score", { ascending: false });

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  return NextResponse.json({ quiz, submissions: submissions ?? [] });
}
