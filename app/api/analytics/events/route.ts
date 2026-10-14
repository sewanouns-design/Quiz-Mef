import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { normalizeAnalyticsEvent, type NormalizedAnalyticsEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origine invalide" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const inputEvents: unknown[] = Array.isArray(body?.events) ? body.events.slice(0, 25) : [body];
  const events = inputEvents
    .map((input: unknown) => normalizeAnalyticsEvent(input, request.headers))
    .filter((event): event is NormalizedAnalyticsEvent => event !== null && !event.isBot);

  if (events.length === 0) {
    return NextResponse.json({ accepted: 0 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("analytics_events").insert(
    events.map((event) => ({
      event_type: event.eventType,
      visitor_id: event.visitorId,
      session_id: event.sessionId,
      path: event.path,
      page_title: event.pageTitle ?? null,
      referrer: event.referrer ?? null,
      target_path: event.targetPath ?? null,
      event_name: event.eventName ?? null,
      label: event.label ?? null,
      device_type: event.deviceType,
      browser: event.browser,
      operating_system: event.operatingSystem,
      country_code: event.countryCode,
      region: event.region,
      city: event.city,
      screen_width: event.screenWidth ?? null,
      screen_height: event.screenHeight ?? null,
      duration_ms: event.durationMs ?? null,
      metadata: event.metadata ?? null,
      is_bot: event.isBot,
    }))
  );

  if (error) {
    console.error("Erreur enregistrement Analytics :", error.message);
    return NextResponse.json({ error: "Événement non enregistré" }, { status: 500 });
  }

  return NextResponse.json({ accepted: events.length });
}
