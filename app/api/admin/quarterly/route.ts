import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quarterly_competitions")
    .select("id, title, period_start, period_end, final_quiz_id, winner_count, created_at, updated_at, final_quiz:daily_quizzes(id, title, category)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ competitions: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const periodStart = body?.periodStart;
  const periodEnd = body?.periodEnd;
  const finalQuizId = body?.finalQuizId;
  const winnerCount = Number(body?.winnerCount);

  if (!title) return NextResponse.json({ error: "Le nom de la compétition est requis." }, { status: 400 });
  if (!validDate(periodStart) || !validDate(periodEnd) || periodEnd < periodStart) {
    return NextResponse.json({ error: "La période du trimestre est invalide." }, { status: 400 });
  }
  if (typeof finalQuizId !== "string" || !finalQuizId) {
    return NextResponse.json({ error: "Sélectionne le quiz trimestriel final." }, { status: 400 });
  }
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 100) {
    return NextResponse.json({ error: "Le nombre de gagnants doit être compris entre 1 et 100." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: finalQuiz, error: finalQuizError } = await supabase
    .from("daily_quizzes")
    .select("id, title, category")
    .eq("id", finalQuizId)
    .maybeSingle();
  if (finalQuizError) return NextResponse.json({ error: finalQuizError.message }, { status: 500 });
  if (!finalQuiz || finalQuiz.category !== "quarterly") {
    return NextResponse.json({ error: "Le quiz choisi doit être un quiz trimestriel." }, { status: 400 });
  }

  const { data: competition, error } = await supabase
    .from("quarterly_competitions")
    .insert({
      title,
      period_start: periodStart,
      period_end: periodEnd,
      final_quiz_id: finalQuizId,
      winner_count: winnerCount,
    })
    .select("id, title, period_start, period_end, final_quiz_id, winner_count, created_at, updated_at")
    .single();
  if (error || !competition) {
    return NextResponse.json({ error: error?.message ?? "Impossible de créer la compétition." }, { status: 500 });
  }
  return NextResponse.json({ competition }, { status: 201 });
}
