import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { logAdminActivity } from "@/lib/admin-activity";
import type { HomeStep, HomeTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_TEMPLATES: HomeTemplate[] = ["steps", "minimal", "card"];

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
  } = body ?? {};

  if (template && !VALID_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: "Template invalide" }, { status: 400 });
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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_settings")
    .upsert({ id: "default", ...updates }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
