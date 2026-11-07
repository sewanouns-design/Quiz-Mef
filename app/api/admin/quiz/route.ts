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
  const { title, subtitle, isActive, questions, durationSeconds, expiresAt, quizMode, category } =
    body ?? {};

  if (!title) {
    return NextResponse.json({ error: "Le titre est requis" }, { status: 400 });
  }

  const parsedCategory =
    category === "quarterly" ? "quarterly" : category === "weekly" ? "weekly" : "daily";
  const validation = validateQuizQuestions(questions, parsedCategory);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const parsedDuration =
    typeof durationSeconds === "number" && durationSeconds > 0 ? durationSeconds : null;
  const parsedMode = quizMode === "sequential" ? "sequential" : "overview";
  const parsedSubtitle = typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null;
  const parsedExpiresAt = typeof expiresAt === "string" && expiresAt ? expiresAt : null;

  const supabase = getSupabaseAdmin();

  // Plusieurs quiz peuvent rester actifs en même temps (quiz du jour +
  // quiz hebdo, par exemple) : on n'en désactive plus d'autres ici.
  const { data: quiz, error: quizError } = await supabase
    .from("daily_quizzes")
    .insert({
      title,
      subtitle: parsedSubtitle,
      is_active: Boolean(isActive),
      duration_seconds: parsedDuration,
      expires_at: parsedExpiresAt,
      quiz_mode: parsedMode,
      category: parsedCategory,
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

  // L'envoi de la notification push est désormais déclenché côté base de
  // données (trigger Postgres `trg_notify_quiz_created`, voir migration
  // quiz_push_notification_webhook) : il se déclenche quelle que soit la
  // façon dont le quiz est créé (ce formulaire, l'automatisation
  // programmée, ou une insertion directe) — pas seulement depuis l'admin.
  if (isActive) revalidateTag("home");

  return NextResponse.json({ quiz });
}
