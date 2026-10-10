import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { logAdminActivity } from "@/lib/admin-activity";
import { sendPushToAllSubscribers } from "@/lib/push";
import type { HomeStep, HomeTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TEMPLATES: HomeTemplate[] = ["steps", "minimal", "card"];
const VALID_TEXT_SIZES = ["normal", "large", "xlarge"];

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const {
    template,
    color_primary,
    color_primary_light,
    color_primary_dark,
    color_accent,
    color_accent_light,
    color_accent_dark,
    color_secondary,
    color_secondary_light,
    color_secondary_dark,
    color_background,
    color_text,
    font_family,
    logo_icon,
    hero_title,
    hero_subtitle,
    steps,
    verse_text,
    verse_reference,
    footer_text,
    show_stats,
    site_name,
    start_button_text,
    stat_label_participants,
    stat_label_quizzes,
    stat_label_submissions,
    activity_ticker_phrase,
    returning_greeting,
    text_size,
    about_text,
    verse_game_enabled,
    verse_game_schedule_enabled,
    verse_game_schedule_start,
    verse_game_schedule_end,
    verse_game_timer_enabled,
    verse_game_timer_seconds,
    quiz_share_direct_link_enabled,
    notify_push_new_quiz,
    notify_push_new_update,
    notify_push_verse_game_reopened,
  } = body ?? {};

  if (template && !VALID_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: "Template invalide" }, { status: 400 });
  }

  if (text_size && !VALID_TEXT_SIZES.includes(text_size)) {
    return NextResponse.json({ error: "Taille de texte invalide" }, { status: 400 });
  }

  if (steps !== undefined) {
    const validSteps =
      Array.isArray(steps) &&
      steps.every(
        (s: HomeStep) =>
          typeof s?.icon === "string" &&
          typeof s?.title === "string" &&
          typeof s?.description === "string"
      );
    if (!validSteps) {
      return NextResponse.json({ error: "Format des étapes invalide" }, { status: 400 });
    }
  }

  let parsedScheduleStart: string | null | undefined;
  if (verse_game_schedule_start !== undefined) {
    if (verse_game_schedule_start === null || verse_game_schedule_start === "") {
      parsedScheduleStart = null;
    } else {
      const d = new Date(verse_game_schedule_start);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Date de début du créneau invalide" }, { status: 400 });
      }
      parsedScheduleStart = d.toISOString();
    }
  }
  let parsedScheduleEnd: string | null | undefined;
  if (verse_game_schedule_end !== undefined) {
    if (verse_game_schedule_end === null || verse_game_schedule_end === "") {
      parsedScheduleEnd = null;
    } else {
      const d = new Date(verse_game_schedule_end);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Date de fin du créneau invalide" }, { status: 400 });
      }
      parsedScheduleEnd = d.toISOString();
    }
  }
  if (parsedScheduleStart && parsedScheduleEnd && parsedScheduleStart >= parsedScheduleEnd) {
    return NextResponse.json(
      { error: "La fin du créneau doit être après son début" },
      { status: 400 }
    );
  }

  let parsedTimerSeconds: number | undefined;
  if (verse_game_timer_seconds !== undefined) {
    parsedTimerSeconds = Number(verse_game_timer_seconds);
    if (!Number.isInteger(parsedTimerSeconds) || parsedTimerSeconds < 3 || parsedTimerSeconds > 300) {
      return NextResponse.json(
        { error: "La durée du chrono doit être un entier entre 3 et 300 secondes" },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (template !== undefined) updates.template = template;
  if (color_primary !== undefined) updates.color_primary = color_primary;
  if (color_primary_light !== undefined) updates.color_primary_light = color_primary_light;
  if (color_primary_dark !== undefined) updates.color_primary_dark = color_primary_dark;
  if (color_accent !== undefined) updates.color_accent = color_accent;
  if (color_accent_light !== undefined) updates.color_accent_light = color_accent_light;
  if (color_accent_dark !== undefined) updates.color_accent_dark = color_accent_dark;
  if (color_secondary !== undefined) updates.color_secondary = color_secondary;
  if (color_secondary_light !== undefined) updates.color_secondary_light = color_secondary_light;
  if (color_secondary_dark !== undefined) updates.color_secondary_dark = color_secondary_dark;
  if (color_background !== undefined) updates.color_background = color_background;
  if (color_text !== undefined) updates.color_text = color_text;
  if (font_family !== undefined) updates.font_family = font_family;
  if (logo_icon !== undefined) updates.logo_icon = logo_icon;
  if (hero_title !== undefined) updates.hero_title = hero_title;
  if (hero_subtitle !== undefined) updates.hero_subtitle = hero_subtitle;
  if (steps !== undefined) updates.steps = steps;
  if (verse_text !== undefined) updates.verse_text = verse_text;
  if (verse_reference !== undefined) updates.verse_reference = verse_reference;
  if (footer_text !== undefined) updates.footer_text = footer_text;
  if (show_stats !== undefined) updates.show_stats = Boolean(show_stats);
  if (site_name !== undefined) updates.site_name = site_name;
  if (start_button_text !== undefined) updates.start_button_text = start_button_text;
  if (stat_label_participants !== undefined) updates.stat_label_participants = stat_label_participants;
  if (stat_label_quizzes !== undefined) updates.stat_label_quizzes = stat_label_quizzes;
  if (stat_label_submissions !== undefined) updates.stat_label_submissions = stat_label_submissions;
  if (activity_ticker_phrase !== undefined) updates.activity_ticker_phrase = activity_ticker_phrase;
  if (returning_greeting !== undefined) updates.returning_greeting = returning_greeting;
  if (text_size !== undefined) updates.text_size = text_size;
  if (about_text !== undefined) updates.about_text = about_text;
  if (verse_game_enabled !== undefined) updates.verse_game_enabled = Boolean(verse_game_enabled);
  if (verse_game_schedule_enabled !== undefined)
    updates.verse_game_schedule_enabled = Boolean(verse_game_schedule_enabled);
  if (parsedScheduleStart !== undefined) updates.verse_game_schedule_start = parsedScheduleStart;
  if (parsedScheduleEnd !== undefined) updates.verse_game_schedule_end = parsedScheduleEnd;
  if (verse_game_timer_enabled !== undefined)
    updates.verse_game_timer_enabled = Boolean(verse_game_timer_enabled);
  if (parsedTimerSeconds !== undefined) updates.verse_game_timer_seconds = parsedTimerSeconds;
  if (quiz_share_direct_link_enabled !== undefined)
    updates.quiz_share_direct_link_enabled = Boolean(quiz_share_direct_link_enabled);
  if (notify_push_new_quiz !== undefined)
    updates.notify_push_new_quiz = Boolean(notify_push_new_quiz);
  if (notify_push_new_update !== undefined)
    updates.notify_push_new_update = Boolean(notify_push_new_update);
  if (notify_push_verse_game_reopened !== undefined)
    updates.notify_push_verse_game_reopened = Boolean(notify_push_verse_game_reopened);

  const supabase = getSupabaseAdmin();

  // Pour détecter une réouverture du jeu (false → true) et déclencher la
  // notification push correspondante une fois la mise à jour effectuée.
  const wasVerseGameEnabled =
    verse_game_enabled !== undefined ? (await getSiteSettings()).verse_game_enabled : null;

  const { data, error } = await supabase
    .from("site_settings")
    .upsert({ id: "default", ...updates }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (
    wasVerseGameEnabled === false &&
    data.verse_game_enabled === true &&
    data.notify_push_verse_game_reopened
  ) {
    await sendPushToAllSubscribers({
      title: "Le jeu est de retour",
      body: "« Trouve le verset » est de nouveau jouable !",
      url: "/trouve-le-verset",
    });
  }

  await logAdminActivity(
    "settings_updated",
    `Personnalisation du site modifiée (${Object.keys(updates).filter((k) => k !== "updated_at").join(", ") || "aucun champ"})`
  );

  // La page d'accueil est mise en cache (ISR) pour la vitesse : sans ça, un
  // changement de couleurs/template resterait invisible jusqu'à expiration
  // du cache (5 min).
  revalidateTag("home");

  return NextResponse.json({ settings: data });
}
