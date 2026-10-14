import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";
import { sendPushToAllSubscribers } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(
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
  const { data: quiz, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, is_active")
    .eq("id", params.quizId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  if (!quiz.is_active) {
    return NextResponse.json({ error: "Le quiz doit être actif pour envoyer sa notification." }, { status: 400 });
  }

  const sent = await sendPushToAllSubscribers({
    notificationType: "manual_quiz",
    title: "Nouveau quiz disponible",
    body: `« ${quiz.title} » — teste tes connaissances dès maintenant !`,
    url: `/quiz?quiz=${encodeURIComponent(quiz.id)}`,
  });

  await logAdminActivity("quiz_notification_sent", `Notification envoyée : ${quiz.title}`, {
    quizId: quiz.id,
    sent,
  });

  return NextResponse.json({ ok: true, sent, message: `Notification envoyée à ${sent} appareil(s).` });
}
