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
  return NextResponse.json({ logoIcon: settings.logo_icon });
}
