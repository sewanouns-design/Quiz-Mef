import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import type { QuestionImport } from "@/lib/types";

export const dynamic = "force-dynamic";

function validateQuestions(questions: unknown): questions is QuestionImport[] {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  return questions.every((q) => {
    if (typeof q !== "object" || q === null) return false;
    const question = q as Record<string, unknown>;
    const validType = ["mcq", "true_false", "short", "fill_blank", "open"].includes(
      question.type as string
    );
    const hasQuestionText = typeof question.question === "string" && question.question.length > 0;
    const hasPoints = typeof question.points === "number";
    return validType && hasQuestionText && hasPoints;
  });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { title, lessonDate, isActive, questions, timeLimitMinutes } = body ?? {};

  if (!title || !lessonDate) {
    return NextResponse.json(
      { error: "title et lessonDate sont requis" },
      { status: 400 }
    );
  }

  if (!validateQuestions(questions)) {
    return NextResponse.json(
      { error: "Le format JSON des questions est invalide." },
      { status: 400 }
    );
  }

  const parsedTimeLimit =
    typeof timeLimitMinutes === "number" && timeLimitMinutes > 0 ? timeLimitMinutes : null;

  const supabase = getSupabaseAdmin();

  if (isActive) {
    await supabase.from("daily_quizzes").update({ is_active: false }).eq("is_active", true);
  }

  const { data: quiz, error: quizError } = await supabase
    .from("daily_quizzes")
    .insert({
      title,
      lesson_date: lessonDate,
      is_active: Boolean(isActive),
      time_limit_minutes: parsedTimeLimit,
    })
    .select()
    .single();

  if (quizError || !quiz) {
    return NextResponse.json(
      { error: quizError?.message ?? "Erreur lors de la création du quiz" },
      { status: 500 }
    );
  }

  const questionRows = (questions as QuestionImport[]).map((q, index) => ({
    quiz_id: quiz.id,
    type: q.type,
    question: q.question,
    options: q.options ?? null,
    correct_option: q.correctOption ?? null,
    correct_text: q.correctText ?? null,
    justification: q.justification ?? null,
    points: q.points,
    position: index,
  }));

  const { error: questionsError } = await supabase.from("daily_questions").insert(questionRows);

  if (questionsError) {
    await supabase.from("daily_quizzes").delete().eq("id", quiz.id);
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({ quiz });
}
