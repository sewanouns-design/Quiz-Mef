import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendReengagementEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MILESTONES: (24 | 48 | 72)[] = [24, 48, 72];
const SITE_URL = "https://quiz.mefzogbadje.org";

/**
 * Relance quotidienne (cf. vercel.json) des participants n'ayant pas repassé
 * de quiz 24h / 48h / 72h après leur dernière soumission, tant qu'un quiz
 * est actif. Une seule relance envoyée par exécution et par participant
 * (le palier suivant non encore envoyé), pour éviter une rafale de 3 emails
 * d'un coup après une longue absence.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();

  const { data: activeQuiz, error: activeQuizError } = await supabase
    .from("daily_quizzes")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (activeQuizError) {
    return NextResponse.json({ error: activeQuizError.message }, { status: 500 });
  }
  if (!activeQuiz) {
    return NextResponse.json({ ok: true, sent: 0, reason: "Aucun quiz actif" });
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, name, email");

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  let sent = 0;
  const now = Date.now();

  for (const participant of participants ?? []) {
    if (!participant.email) continue;

    const { data: lastSubmission } = await supabase
      .from("daily_submissions")
      .select("id, submitted_at, quiz_id")
      .eq("participant_id", participant.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastSubmission) continue;
    // Déjà passé le quiz actif du jour : rien à relancer.
    if (lastSubmission.quiz_id === activeQuiz.id) continue;

    const hoursSince = (now - new Date(lastSubmission.submitted_at).getTime()) / (1000 * 60 * 60);

    for (const milestone of MILESTONES) {
      if (hoursSince < milestone) break;

      const { data: existing } = await supabase
        .from("reengagement_reminders")
        .select("id")
        .eq("participant_id", participant.id)
        .eq("submission_id", lastSubmission.id)
        .eq("milestone_hours", milestone)
        .maybeSingle();

      if (existing) continue;

      try {
        await sendReengagementEmail({
          to: participant.email,
          participantName: participant.name,
          milestoneHours: milestone,
          quizUrl: `${SITE_URL}/quiz/${activeQuiz.id}`,
        });
        await supabase.from("reengagement_reminders").insert({
          participant_id: participant.id,
          submission_id: lastSubmission.id,
          milestone_hours: milestone,
        });
        sent += 1;
      } catch (err) {
        console.error(`Erreur envoi relance ${milestone}h pour ${participant.id} :`, err);
      }
      break;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
