import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const quizId = request.nextUrl.searchParams.get("quizId");

  let query = supabase
    .from("lesson_questions")
    .select(
      "id, question_text, created_at, participant:participants(id, name, address, email, whatsapp), quiz:daily_quizzes(id, title, lesson_date)"
    )
    .order("created_at", { ascending: false });

  if (quizId) {
    query = query.eq("quiz_id", quizId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data ?? [] });
}
