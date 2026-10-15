import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isPassingScore, MAX_ATTEMPTS } from "@/lib/scoring";
import type { PublicQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  const supabase = getSupabaseAdmin();
  const deviceKey = request.nextUrl.searchParams.get("deviceKey");
  const explicitRetry = request.nextUrl.searchParams.get("retry") === "1";

  // Le quiz et ses questions sont indépendants : les charger en parallèle
  // évite un aller-retour réseau supplémentaire à chaque ouverture du quiz.
  const [
    { data: quiz, error: quizError },
    { data: questions, error: questionsError },
  ] = await Promise.all([
    supabase
      .from("daily_quizzes")
      .select("id, title, subtitle, is_active, duration_seconds, quiz_mode, category")
      .eq("id", params.quizId)
      .maybeSingle(),
    supabase
      .from("daily_questions")
      .select("id, quiz_id, type, question, options, points, position")
      .eq("quiz_id", params.quizId)
      .order("position", { ascending: true }),
  ]);

  if (quizError) {
    return NextResponse.json({ error: quizError.message }, { status: 500 });
  }
  if (!quiz) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  let alreadySubmitted = false;
  let isRetry = false;
  let resultToken: string | null = null;
  let remaining: number | null = null;
  if (deviceKey) {
    // Une seule requête (jointure sur participants) au lieu de deux
    // allers-retours séquentiels (chercher le participant, puis ses
    // soumissions) : le filtre sur device_key s'applique directement via
    // la ressource imbriquée.
    const { data: submissions } = await supabase
      .from("daily_submissions")
      .select("score, max_score, cancelled, attempt_number, result_token, participant:participants!inner(device_key)")
      .eq("quiz_id", params.quizId)
      .eq("participant.device_key", deviceKey)
      .order("attempt_number", { ascending: true });

    // Une tentative annulée (sortie de page répétée, appel entrant...) ne
    // compte jamais comme une vraie tentative : elle ne doit ni bloquer un
    // nouvel essai, ni le faire passer pour une tentative supplémentaire.
    const realAttempts = (submissions ?? []).filter((s) => !s.cancelled);
    const officialAttempt = realAttempts[0];
    const passedOfficialAttempt = officialAttempt
      ? isPassingScore(officialAttempt.score, officialAttempt.max_score)
      : false;
    const maxAllowedAttempts = quiz.category === "quarterly"
      ? 1
      : passedOfficialAttempt
        ? Number.POSITIVE_INFINITY
        : MAX_ATTEMPTS;
    if (realAttempts.length > 0) {
      if ((!explicitRetry && passedOfficialAttempt) || realAttempts.length >= maxAllowedAttempts) {
        alreadySubmitted = true;
        // La première tentative valide est officielle.
        resultToken = realAttempts[0].result_token;
      } else {
        isRetry = true;
        remaining = Number.isFinite(maxAllowedAttempts)
          ? Math.max(0, maxAllowedAttempts - realAttempts.length)
          : null;
      }
    }
  }

  return NextResponse.json({
    quiz,
    questions: (questions ?? []) as PublicQuestion[],
    alreadySubmitted,
    isRetry,
    resultToken,
    attemptsRemaining: remaining,
  });
}
