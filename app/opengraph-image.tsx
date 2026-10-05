import { readFileSync } from "fs";
import { join } from "path";
import { ImageResponse } from "next/og";
import { unstable_cache } from "next/cache";
import { getSiteSettings } from "@/lib/site-settings";
import { isImageLogo } from "@/components/LogoIcon";

// Rendre un emoji couleur (ex: le "⁉️" par défaut) demanderait à Satori
// d'aller chercher l'image Twemoji correspondante sur un CDN externe à
// chaque génération — une dépendance réseau fragile pour l'unique élément
// visuel de cet aperçu. On réutilise directement l'icône du site (déjà sur
// le disque, donc fiable à 100%) comme repli dès que ce n'est pas un logo
// personnalisé (image) uploadé par l'admin.
const DEFAULT_LOGO_DATA_URL = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "app/apple-icon.png")
).toString("base64")}`;

export const runtime = "nodejs";
// Sans ça, cette image serait figée au build (avec les réglages par défaut,
// faute de variables d'environnement Supabase disponibles à ce moment-là) et
// ne refléterait plus jamais les changements de personnalisation — comme
// pour app/page.tsx, c'est la DONNÉE qui est mise en cache (unstable_cache
// ci-dessous), pas la page.
export const dynamic = "force-dynamic";
export const alt = "Quiz Biblique";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Mêmes paramètres (couleurs, logo, titre) que la page d'accueil, avec le
// même tag de cache "home" : l'aperçu de lien reste à jour automatiquement
// dès qu'un changement de personnalisation est enregistré dans l'admin.
const getCachedSettings = unstable_cache(getSiteSettings, ["og-image-settings"], {
  revalidate: 300,
  tags: ["home"],
});

export default async function OpengraphImage() {
  const settings = await getCachedSettings();
  const logoSrc = isImageLogo(settings.logo_icon) ? settings.logo_icon : DEFAULT_LOGO_DATA_URL;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `linear-gradient(160deg, ${settings.color_primary}, ${settings.color_primary_dark})`,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 140,
            height: 140,
            borderRadius: 32,
            backgroundColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={96} height={96} style={{ objectFit: "contain" }} />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            maxWidth: 1000,
            lineHeight: 1.15,
          }}
        >
          {settings.hero_title}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 30,
            color: "rgba(255,255,255,0.75)",
            textAlign: "center",
            maxWidth: 860,
          }}
        >
          {settings.hero_subtitle}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            padding: "14px 32px",
            borderRadius: 999,
            backgroundColor: settings.color_accent,
            color: "#ffffff",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          quiz.mefzogbadje.org
        </div>
      </div>
    ),
    size
  );
}
