import webpush from "web-push";
import { getSupabaseAdmin } from "./supabase";

let configured = false;

type PushPayload = {
  title: string;
  body: string;
  url: string;
  notificationType?: string;
};

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

async function logPushDispatch(payload: PushPayload, stats: {
  targetCount: number;
  sentCount: number;
  failedCount: number;
  removedCount: number;
}) {
  try {
    await getSupabaseAdmin().from("push_notification_logs").insert({
      notification_type: payload.notificationType ?? "general",
      title: payload.title,
      body: payload.body,
      url: payload.url,
      target_count: stats.targetCount,
      sent_count: stats.sentCount,
      failed_count: stats.failedCount,
      removed_count: stats.removedCount,
    });
  } catch (error) {
    // Le journal ne doit jamais bloquer une notification déjà envoyée.
    console.error("Impossible de journaliser la diffusion push :", error);
  }
}

/** Envoie une notification à tous les appareils abonnés d’un participant. */
export async function sendPushToParticipant(
  participantId: string,
  payload: PushPayload
): Promise<number> {
  if (!ensureConfigured()) return 0;

  const supabase = getSupabaseAdmin();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("participant_id", participantId);

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed += 1;
      } else {
        failed += 1;
        console.error(`Erreur envoi push (abonnement ${sub.id}) :`, err);
      }
    }
  }

  await logPushDispatch(payload, {
    targetCount: subscriptions?.length ?? 0,
    sentCount: sent,
    failedCount: failed,
    removedCount: removed,
  });
  return sent;
}

/** Diffuse une notification à tous les appareils abonnés. */
export async function sendPushToAllSubscribers(payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const supabase = getSupabaseAdmin();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed += 1;
      } else {
        failed += 1;
        console.error(`Erreur diffusion push (abonnement ${sub.id}) :`, err);
      }
    }
  }

  await logPushDispatch(payload, {
    targetCount: subscriptions?.length ?? 0,
    sentCount: sent,
    failedCount: failed,
    removedCount: removed,
  });
  return sent;
}
