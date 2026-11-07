import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteSettings } from "@/lib/site-settings";
import { sendPushToAllSubscribers } from "@/lib/push";
import { logAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

/**
 * Déclenché par le trigger Postgres `trg_notify_quiz_created` (voir
 * migration quiz_push_notification_webhook) dès qu'un quiz quotidien actif
 * est inséré ou activé — quelle que soit la façon dont il a été créé
 * (admin, automatisation programmée, insertion directe en base). Couvre
 * ainsi tous les cas, là où un envoi déclenché uniquement depuis la route
 * admin de création manquait les quiz créés autrement.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const quizId = typeof body?.quizId === "string" ? body.quizId : null;
  if (!quizId) {
    return NextResponse.json({ error: "quizId manquant" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: quiz, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, is_active")
    .eq("id", quizId)
    .maybeSingle();

  if (error || !quiz || !quiz.is_active) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  revalidateTag("home");

  const settings = await getSiteSettings();
  if (!settings.notify_push_new_quiz) {
    return NextResponse.json({ ok: true, skipped: true, reason: "notify_push_new_quiz désactivé" });
  }

  const sent = await sendPushToAllSubscribers({
    notificationType: "new_quiz",
    title: "Nouveau quiz disponible",
    body: `« ${quiz.title} » — teste tes connaissances dès maintenant !`,
    url: `/quiz?quiz=${encodeURIComponent(quiz.id)}`,
  });

  await logAdminActivity("quiz_notification_sent", `Notification envoyée (automatique) : ${quiz.title}`, {
    quizId: quiz.id,
    sent,
  });

  return NextResponse.json({ ok: true, sent });
}
