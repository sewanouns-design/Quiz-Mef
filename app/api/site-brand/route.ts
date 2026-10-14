import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

// Petit point d'accès public (aucune donnée sensible : le logo est déjà
// exposé via og:image) pour que les composants client — comme l'en-tête
// affiché sur chaque page — puissent afficher le vrai logo du site sans
// pouvoir utiliser la clé service_role réservée au serveur.
const getCachedSettings = unstable_cache(getSiteSettings, ["site-brand-settings"], {
  revalidate: 300,
  tags: ["home"],
});

export async function GET() {
  const settings = await getCachedSettings();
  return NextResponse.json({
    logoIcon: settings.logo_icon,
    siteName: settings.site_name,
    quizShareDirectLinkEnabled: settings.quiz_share_direct_link_enabled,
    resultShareTemplate: settings.result_share_template,
    resultShareCustomBackground: settings.result_share_custom_background,
    resultShareCustomTextColor: settings.result_share_custom_text_color,
    resultShareCustomTitleY: settings.result_share_custom_title_y,
    resultShareCustomNameY: settings.result_share_custom_name_y,
    resultShareCustomScoreY: settings.result_share_custom_score_y,
    resultShareDailyConfig: settings.result_share_daily_config,
    resultShareQuarterlyConfig: settings.result_share_quarterly_config,
  });
}
