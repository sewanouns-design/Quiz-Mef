import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SubmissionRow {
  id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  participant: { id: string; name: string; parish: string } | null;
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
    .select("id, title, lesson_date")
    .eq("id", params.quizId)
    .maybeSingle();

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("daily_submissions")
    .select("id, score, max_score, submitted_at, participant:participants(id, name, parish)")
    .eq("quiz_id", params.quizId);

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const rows = (submissions ?? []) as unknown as SubmissionRow[];

  const byParish = new Map<
    string,
    { totalScore: number; count: number; participants: { name: string; score: number; maxScore: number }[] }
  >();

  for (const row of rows) {
    const parish = row.participant?.parish || "Non renseignée";
    if (!byParish.has(parish)) {
      byParish.set(parish, { totalScore: 0, count: 0, participants: [] });
    }
    const entry = byParish.get(parish)!;
    entry.totalScore += row.score;
    entry.count += 1;
    entry.participants.push({
      name: row.participant?.name || "Anonyme",
      score: row.score,
      maxScore: row.max_score,
    });
  }

  const parishes = Array.from(byParish.entries())
    .map(([parish, entry]) => ({
      parish,
      average: entry.count > 0 ? entry.totalScore / entry.count : 0,
      count: entry.count,
      participants: entry.participants.sort((a, b) => b.score - a.score),
    }))
    .sort((a, b) => b.average - a.average);

  return NextResponse.json({ quiz, parishes });
}
