"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoIcon from "@/components/LogoIcon";
import { getStoredParticipant } from "@/lib/participant-storage";
import type { SiteSettings } from "@/lib/types";
import type { TodayStats } from "./TodayActivityBadge";

/**
 * Entête sticky de la page d'accueil : identité du site + preuve sociale en
 * direct toujours visible en scrollant, et pour un appareil déjà reconnu
 * (localStorage), un accueil personnalisé qui mène droit à l'identification
 * déjà pré-remplie — moins de friction pour les habitués.
 */
export default function HomeTopBar({
  settings,
  todayStats,
}: {
  settings: SiteSettings;
  todayStats: TodayStats | null;
}) {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredParticipant();
    if (stored?.name) setFirstName(stored.name.trim().split(/\s+/)[0]);
  }, []);

  return (
    <div
      className="sticky top-0 z-30 backdrop-blur"
      style={{ backgroundColor: `${settings.color_primary}f2` }}
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/15 text-sm">
            <LogoIcon value={settings.logo_icon} className="h-4 w-4" />
          </div>
          <span>Quiz MEF</span>
          {todayStats && todayStats.count > 0 && (
            <span className="hidden text-xs font-normal text-white/70 sm:inline">
              · 🔥 {todayStats.count} aujourd&apos;hui
            </span>
          )}
        </div>
        {firstName && (
          <Link
            href="/quiz"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
          >
            👋 Content de te revoir, {firstName}
          </Link>
        )}
      </div>
    </div>
  );
}
