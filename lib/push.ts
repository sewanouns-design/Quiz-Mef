import webpush from "web-push";
import { getSupabaseAdmin } from "./supabase";

let configured = false;

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

/**
 * Envoie une notification push à un participant sur TOUS ses appareils
 * abonnés. Best-effort : un abonnement expiré/révoqué (410/404) est
 * supprimé silencieusement plutôt que de faire échouer l'envoi.
 */
export async function sendPushToParticipant(
  participantId: string,
  payload: { title: string; body: string; url: string }
): Promise<number> {
  if (!ensureConfigured()) return 0;

  const supabase = getSupabaseAdmin();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("participant_id", participantId);

  let sent = 0;
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error(`Erreur envoi push (abonnement ${sub.id}) :`, err);
      }
    }
  }
  return sent;
}
