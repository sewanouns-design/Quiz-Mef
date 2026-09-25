import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { validateQuizQuestions } from "@/lib/quiz-validation";
import { logAdminActivity } from "@/lib/admin-activity";
import type { QuestionImport } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { title, lessonDate, isActive, questions, durationSeconds, quizMode } = body ?? {};

  if (!title || !lessonDate) {
    return NextResponse.json(
      { error: "title et lessonDate sont requis" },
      { status: 400 }
    );
  }

  const validation = validateQuizQuestions(questions);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const parsedDuration =
    typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : null;
  const parsedMode = quizMode === "sequential" ? "sequential" : "overview";

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
      duration_seconds: parsedDuration,
      quiz_mode: parsedMode,
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

  await logAdminActivity("quiz_created", `Quiz créé : ${quiz.title}`, {
    quizId: quiz.id,
    isActive: Boolean(isActive),
  });

  if (isActive) revalidateTag("home");

  return NextResponse.json({ quiz });
}
