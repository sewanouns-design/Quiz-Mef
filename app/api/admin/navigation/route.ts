import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import {
  ADMIN_NAVIGATION_TAB_IDS,
  DEFAULT_ADMIN_NAVIGATION,
  normalizeAdminNavigation,
  type AdminNavigationConfig,
} from "@/lib/admin-navigation";
import { getSiteSettings } from "@/lib/site-settings";
import { logAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

function isValidConfiguration(config: AdminNavigationConfig): boolean {
  const ids = config.categories.flatMap((category) => category.items.map((item) => item.id));
  if (ids.length !== ADMIN_NAVIGATION_TAB_IDS.length || new Set(ids).size !== ids.length) return false;
  return ADMIN_NAVIGATION_TAB_IDS.every((id) => ids.includes(id));
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const settings = await getSiteSettings();
  return NextResponse.json({ navigation: settings.admin_navigation ?? DEFAULT_ADMIN_NAVIGATION });
}

export async function PUT(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const navigation = normalizeAdminNavigation(body?.navigation);
  if (!isValidConfiguration(navigation)) {
    return NextResponse.json(
      { error: "La navigation doit conserver chaque onglet existant une seule fois." },
      { status: 400 }
    );
  }
  if (navigation.categories.length > 30) {
    return NextResponse.json({ error: "Trop de groupes principaux." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_settings")
    .upsert(
      { id: "default", admin_navigation: navigation, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    )
    .select("admin_navigation")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminActivity("settings_updated", "Organisation des onglets admin modifiée", {
    categories: navigation.categories.map((category) => ({
      id: category.id,
      label: category.label,
      items: category.items.map((item) => item.id),
    })),
  });

  return NextResponse.json({ navigation: data?.admin_navigation ?? navigation });
}
