import { getSupabaseAdmin } from "./supabase";
import type { SiteSettings } from "./types";

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: "default",
  template: "steps",
  color_primary: "#14213d",
  color_primary_light: "#2c4570",
  color_primary_dark: "#0a1428",
  color_accent: "#0d9488",
  color_accent_light: "#2dd4bf",
  color_accent_dark: "#0f766e",
  color_secondary: "#2563eb",
  color_secondary_light: "#60a5fa",
  color_secondary_dark: "#1d4ed8",
  color_background: "#f7f6f2",
  color_text: "#374151",
  font_family: "Inter",
  logo_icon: "⁉️",
  hero_title: "Quiz Biblique du Jour",
  hero_subtitle: "Teste tes connaissances sur la leçon du jour",
  steps: [
    {
      icon: "📝",
      title: "Identifie-toi",
      description: "Ton nom et ton adresse suffisent pour commencer.",
    },
    {
      icon: "⁉️",
      title: "Réponds au quiz",
      description: "Des questions sur la leçon du jour, à ton rythme.",
    },
    {
      icon: "📊",
      title: "Reçois tes résultats",
      description: "Score détaillé, corrections, et un email récapitulatif.",
    },
  ],
  verse_text: "Sonde les écritures, car ce sont elles qui rendent témoignage de moi.",
  verse_reference: "Jean 5:39",
  footer_text: "Quiz Biblique — Mission Évangélique de la Foi",
  show_stats: true,
  updated_at: "",
};

export const FONT_OPTIONS = [
  { value: "Inter", label: "Inter (moderne, sobre)" },
  { value: "Poppins", label: "Poppins (rond, chaleureux)" },
  { value: "Nunito", label: "Nunito (doux, arrondi)" },
  { value: "Work Sans", label: "Work Sans (net, professionnel)" },
  { value: "Lora", label: "Lora (élégant, avec empattements)" },
  { value: "Playfair Display", label: "Playfair Display (classique, cérémonieux)" },
];

export const TEMPLATE_OPTIONS: { value: SiteSettings["template"]; label: string; description: string }[] = [
  {
    value: "steps",
    label: "Complet",
    description: "Statistiques, étapes \"Comment ça marche\" et verset.",
  },
  {
    value: "minimal",
    label: "Minimaliste",
    description: "Juste l'essentiel : titre, bouton, verset discret.",
  },
  {
    value: "card",
    label: "Carte centrale",
    description: "Une grande carte visuelle centrée, plus graphique.",
  },
];

/** Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur hexadécimale. */
export function shadeHexColor(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;

  const num = parseInt(normalized, 16);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));

  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function mergeWithDefaults(row: Partial<SiteSettings> | null): SiteSettings {
  if (!row) return DEFAULT_SITE_SETTINGS;
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...row,
    steps:
      Array.isArray(row.steps) && row.steps.length > 0
        ? row.steps
        : DEFAULT_SITE_SETTINGS.steps,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (error) {
      console.error("Erreur récupération site_settings :", error.message);
      return DEFAULT_SITE_SETTINGS;
    }

    return mergeWithDefaults(data);
  } catch (err) {
    console.error("Erreur récupération site_settings :", err);
    return DEFAULT_SITE_SETTINGS;
  }
}
