import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Liste TOUS les quiz (quotidiens, hebdomadaires, trimestriels), sans filtre
 * d'activité ni d'expiration, réservée aux comptes testeurs (is_test=true) :
 * leur permet de parcourir en libre-service l'intégralité du trimestre pour
 * le tester, sans dépendre de liens envoyés manuellement.
 */
export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  if (!deviceKey) {
    return NextResponse.json({ error: "deviceKey requis" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, is_test")
    .eq("device_key", deviceKey)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant || !participant.is_test) {
    return NextResponse.json({ error: "Accès réservé aux comptes testeurs." }, { status: 403 });
  }

  const { data: quizzes, error: quizzesError } = await supabase
    .from("daily_quizzes")
    .select("id, title, subtitle, category, created_at")
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (quizzesError) {
    return NextResponse.json({ error: quizzesError.message }, { status: 500 });
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("daily_submissions")
    .select("quiz_id, score, max_score, cancelled")
    .eq("participant_id", participant.id);

  if (submissionsError) {
    return NextResponse.json({ error: submissionsError.message }, { status: 500 });
  }

  const doneByQuizId = new Map<string, { score: number; maxScore: number }>();
  for (const s of submissions ?? []) {
    if (s.cancelled || !s.quiz_id) continue;
    const existing = doneByQuizId.get(s.quiz_id);
    if (!existing || s.score > existing.score) {
      doneByQuizId.set(s.quiz_id, { score: s.score, maxScore: s.max_score });
    }
  }

  const result = (quizzes ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    subtitle: q.subtitle,
    category: q.category,
    createdAt: q.created_at,
    done: doneByQuizId.has(q.id),
    score: doneByQuizId.get(q.id)?.score ?? null,
    maxScore: doneByQuizId.get(q.id)?.maxScore ?? null,
  }));

  return NextResponse.json({ quizzes: result });
}
