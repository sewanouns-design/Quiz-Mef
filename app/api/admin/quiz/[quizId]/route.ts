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
    .select("*")
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
    .select("*")
    .eq("quiz_id", params.quizId)
    .order("position", { ascending: true });

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  return NextResponse.json({ quiz, questions: questions ?? [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { title, lessonDate, questions, durationSeconds } = body ?? {};

  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {};
  if (title) updates.title = title;
  if (lessonDate) updates.lesson_date = lessonDate;
  if (durationSeconds !== undefined) {
    updates.duration_seconds =
      typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : null;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("daily_quizzes")
      .update(updates)
      .eq("id", params.quizId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (questions !== undefined) {
    if (!validateQuestions(questions)) {
      return NextResponse.json(
        { error: "Le format JSON des questions est invalide." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("daily_questions")
      .delete()
      .eq("quiz_id", params.quizId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const questionRows = (questions as QuestionImport[]).map((q, index) => ({
      quiz_id: params.quizId,
      type: q.type,
      question: q.question,
      options: q.options ?? null,
      correct_option: q.correctOption ?? null,
      correct_text: q.correctText ?? null,
      justification: q.justification ?? null,
      points: q.points,
      position: index,
    }));

    const { error: insertError } = await supabase.from("daily_questions").insert(questionRows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
