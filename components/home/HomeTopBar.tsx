"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoIcon from "@/components/LogoIcon";
import SiteMenu from "@/components/SiteMenu";
import { getStoredParticipant } from "@/lib/participant-storage";
import type { SiteSettings } from "@/lib/types";
import type { TodayStats } from "./todayStats";

const GREETING_VISIBLE_MS = 4000;
const GREETING_LEAVE_MS = 350;

/**
 * Entête sticky de la page d'accueil : logo + nom du site centrés (menu en
 * marge gauche), preuve sociale en direct toujours visible en scrollant. Pour
 * un appareil déjà reconnu (localStorage), un accueil personnalisé apparaît
 * en rebondissant puis repart tout seul après quelques secondes — un simple
 * clin d'œil, pas un élément permanent qui encombre l'entête.
 */
export default function HomeTopBar({
  settings,
  todayStats,
}: {
  settings: SiteSettings;
  todayStats: TodayStats | null;
}) {
  const [firstName, setFirstName] = useState<string | null>(null);
  const [greetingState, setGreetingState] = useState<"hidden" | "visible" | "leaving">("hidden");

  useEffect(() => {
    const stored = getStoredParticipant();
    if (stored?.name) {
      setFirstName(stored.name.trim().split(/\s+/)[0]);
      setGreetingState("visible");
    }
  }, []);

  useEffect(() => {
    if (greetingState !== "visible") return;
    const timer = setTimeout(() => setGreetingState("leaving"), GREETING_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [greetingState]);

  useEffect(() => {
    if (greetingState !== "leaving") return;
    const timer = setTimeout(() => setGreetingState("hidden"), GREETING_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [greetingState]);

  return (
    <div
      className="sticky top-0 z-30 backdrop-blur"
      style={{ backgroundColor: `${settings.color_primary}f2` }}
    >
      <div className="mx-auto max-w-2xl px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center">
            <SiteMenu variant="dark" />
          </div>
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center transition-opacity hover:opacity-90"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-base">
              <LogoIcon value={settings.logo_icon} className="h-5 w-5" />
            </div>
            <span className="truncate text-base font-bold text-white sm:text-lg">
              {settings.site_name}
            </span>
            {todayStats && todayStats.count > 0 && (
              <span className="hidden shrink-0 text-xs font-normal text-white/70 sm:inline">
                · 🔥 {todayStats.count} aujourd&apos;hui
              </span>
            )}
          </Link>
          <div className="w-9 shrink-0" aria-hidden="true" />
        </div>

        {firstName && greetingState !== "hidden" && (
          <div className="flex justify-center pb-1.5 pt-1">
            <Link
              href="/quiz"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-90 ${
                greetingState === "leaving" ? "animate-greeting-leave" : "animate-greeting-pop"
              }`}
              style={{ backgroundColor: settings.color_accent }}
            >
              👋 {settings.returning_greeting}, {firstName}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
