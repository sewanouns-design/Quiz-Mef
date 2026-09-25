import { Inter, Poppins, Nunito, Work_Sans, Lora, Playfair_Display } from "next/font/google";

/**
 * Polices auto-hébergées via next/font (téléchargées et servies depuis notre
 * propre domaine au build), plutôt qu'un @import CSS vers fonts.googleapis.com
 * qui ajoutait 2 allers-retours réseau bloquants vers un domaine externe sur
 * CHAQUE page du site (admin et quiz compris, alors qu'ils n'utilisent que
 * l'Inter par défaut). Inter est appliquée globalement dans app/layout.tsx ;
 * les 5 autres ne sont incluses que dans le bundle de la page d'accueil (via
 * components/home/*), seule à proposer un choix de police.
 */

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-work-sans",
  display: "swap",
});

export const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lora",
  display: "swap",
});

export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-playfair",
  display: "swap",
});

/** Nom choisi dans l'admin (SettingsTab, valeur brute site_settings.font_family) -> variable CSS correspondante. */
export const FONT_VARIABLE_BY_NAME: Record<string, string> = {
  Inter: inter.style.fontFamily,
  Poppins: poppins.style.fontFamily,
  Nunito: nunito.style.fontFamily,
  "Work Sans": workSans.style.fontFamily,
  Lora: lora.style.fontFamily,
  "Playfair Display": playfairDisplay.style.fontFamily,
};

export const ALL_HOME_FONT_VARIABLES = `${poppins.variable} ${nunito.variable} ${workSans.variable} ${lora.variable} ${playfairDisplay.variable}`;

export function resolveFontFamily(name: string): string {
  return FONT_VARIABLE_BY_NAME[name] ?? inter.style.fontFamily;
}
