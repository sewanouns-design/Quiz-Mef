import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { validateQuizQuestions } from "@/lib/quiz-validation";
import { regradeQuiz } from "@/lib/regrade";
import type { QuestionImport } from "@/lib/types";

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

  let regrade: { questionsChecked: number; answersUpdated: number; submissionsUpdated: number } | null =
    null;

  if (questions !== undefined) {
    const validation = validateQuizQuestions(questions);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const incoming = questions as QuestionImport[];

    // Met à jour les questions existantes EN PLACE (par id) plutôt que de
    // tout supprimer/recréer : sinon les réponses déjà enregistrées
    // (daily_answers.question_id) perdraient leur rattachement — via
    // "on delete set null" — et un recalcul (regrade) n'aurait plus rien à
    // réévaluer.
    const { data: existingQuestions, error: existingError } = await supabase
      .from("daily_questions")
      .select("id")
      .eq("quiz_id", params.quizId);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingIds = new Set((existingQuestions ?? []).map((q) => q.id as string));
    const incomingIds = new Set(
      incoming.filter((q) => q.id).map((q) => q.id as string)
    );

    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("daily_questions")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    for (let index = 0; index < incoming.length; index++) {
      const q = incoming[index];
      const row = {
        quiz_id: params.quizId,
        type: q.type,
        question: q.question,
        options: q.options ?? null,
        correct_option: q.correctOption ?? null,
        correct_text: q.correctText ?? null,
        justification: q.justification ?? null,
        points: q.points,
        position: index,
      };

      if (q.id && existingIds.has(q.id)) {
        const { error: rowError } = await supabase
          .from("daily_questions")
          .update(row)
          .eq("id", q.id);
        if (rowError) {
          return NextResponse.json({ error: rowError.message }, { status: 500 });
        }
      } else {
        const { error: rowError } = await supabase.from("daily_questions").insert(row);
        if (rowError) {
          return NextResponse.json({ error: rowError.message }, { status: 500 });
        }
      }
    }

    try {
      regrade = await regradeQuiz(params.quizId);
    } catch (err) {
      // La sauvegarde a réussi ; seul le recalcul a échoué. On le signale
      // sans faire échouer toute la requête (l'admin peut relancer le
      // recalcul manuellement via le bouton dédié).
      console.error("Erreur lors du recalcul automatique des notes :", err);
    }
  }

  return NextResponse.json({ ok: true, regrade });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // daily_submissions.quiz_id n'a pas de "on delete cascade" (contrairement
  // à daily_questions et lesson_questions) : les copies déjà soumises ne
  // disparaissent jamais silencieusement en supprimant un quiz, il faut les
  // supprimer explicitement ici (ce qui entraîne, elles, la suppression en
  // cascade des réponses liées dans daily_answers).
  const { error: submissionsError } = await supabase
    .from("daily_submissions")
    .delete()
    .eq("quiz_id", params.quizId);

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const { error: quizError } = await supabase
    .from("daily_quizzes")
    .delete()
    .eq("id", params.quizId);

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
