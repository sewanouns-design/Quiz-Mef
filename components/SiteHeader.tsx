"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoIcon from "./LogoIcon";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";

/**
 * Repère en haut de chaque page (hors quiz en cours, pour ne pas donner un
 * moyen silencieux de quitter une tentative sans qu'elle soit comptée) :
 * le vrai logo du site, et un bouton « Accueil » explicite plutôt qu'un
 * simple lien discret — plus clair pour un public qui découvre le site.
 * Un bouton « retour » (navigateur) a été volontairement écarté : son
 * comportement dépend de l'historique de navigation et peut surprendre,
 * alors qu'« Accueil » ramène toujours au même endroit, de façon prévisible.
 */
export default function SiteHeader() {
  const [logoIcon, setLogoIcon] = useState(DEFAULT_SITE_SETTINGS.logo_icon);
  const [siteName, setSiteName] = useState(DEFAULT_SITE_SETTINGS.site_name);

  useEffect(() => {
    fetch("/api/site-brand", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.logoIcon) setLogoIcon(data.logoIcon);
        if (data?.siteName) setSiteName(data.siteName);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy text-base">
            <LogoIcon value={logoIcon} className="h-5 w-5" />
          </div>
          <span className="truncate text-sm font-semibold text-navy">{siteName}</span>
        </div>
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm transition-colors hover:border-navy/30"
        >
          🏠 Accueil
        </Link>
      </div>
    </div>
  );
}
