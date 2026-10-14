import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

function maskEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const tail = url.pathname.slice(-18);
    return `${url.host}${tail ? `…${tail}` : ""}`;
  } catch {
    return endpoint.slice(-32);
  }
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const [{ data: subscriptions, error: subscriptionsError }, { data: logs, error: logsError }] =
    await Promise.all([
      supabase
        .from("push_subscriptions")
        .select("id, participant_id, endpoint, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("push_notification_logs")
        .select("id, notification_type, title, body, url, target_count, sent_count, failed_count, removed_count, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (subscriptionsError) return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 });

  const rows = subscriptions ?? [];
  const participantIds = [...new Set(rows.map((row) => row.participant_id).filter(Boolean))];
  const { data: participants, error: participantsError } = participantIds.length
    ? await supabase.from("participants").select("id, name, email").in("id", participantIds)
    : { data: [], error: null };
  if (participantsError) return NextResponse.json({ error: participantsError.message }, { status: 500 });

  const participantMap = new Map((participants ?? []).map((participant) => [participant.id, participant]));
  const cutoff7 = isoDaysAgo(7);
  const cutoff30 = isoDaysAgo(30);
  const recentLogs = (logs ?? []).filter((log) => log.created_at >= cutoff30);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      activeSubscriptions: rows.length,
      subscribedParticipants: new Set(rows.map((row) => row.participant_id).filter(Boolean)).size,
      anonymousSubscriptions: rows.filter((row) => !row.participant_id).length,
      newSubscriptions7d: rows.filter((row) => row.created_at >= cutoff7).length,
      newSubscriptions30d: rows.filter((row) => row.created_at >= cutoff30).length,
      notificationsSent30d: recentLogs.reduce((total, log) => total + (log.sent_count ?? 0), 0),
      notificationsTargeted30d: recentLogs.reduce((total, log) => total + (log.target_count ?? 0), 0),
      dispatches30d: recentLogs.length,
    },
    subscriptions: rows.slice(0, 50).map((row) => ({
      id: row.id,
      participantName: row.participant_id ? participantMap.get(row.participant_id)?.name ?? "Participant inconnu" : "Visiteur non identifié",
      participantEmail: row.participant_id ? participantMap.get(row.participant_id)?.email ?? null : null,
      endpoint: maskEndpoint(row.endpoint),
      createdAt: row.created_at,
    })),
    history: (logs ?? []).map((log) => ({
      id: log.id,
      type: log.notification_type,
      title: log.title,
      body: log.body,
      url: log.url,
      targetCount: log.target_count,
      sentCount: log.sent_count,
      failedCount: log.failed_count,
      removedCount: log.removed_count,
      createdAt: log.created_at,
    })),
  });
}
