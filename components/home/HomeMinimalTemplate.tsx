import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { getRandomVerse } from "@/lib/verses";
import { ALL_HOME_FONT_VARIABLES, resolveFontFamily } from "@/lib/fonts";
import DesktopSideDecoration from "./DesktopSideDecoration";
import LogoIcon from "@/components/LogoIcon";

interface Props {
  settings: SiteSettings;
  activeQuiz: { id: string; title: string; lesson_date: string } | null;
  stats: { participants: number; submissions: number; quizzes: number };
}

export default function HomeMinimalTemplate({ settings, activeQuiz }: Props) {
  const primary = settings.color_primary;
  const accentDark = settings.color_accent_dark;
  const verse = getRandomVerse();

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center px-6 py-16 ${ALL_HOME_FONT_VARIABLES}`}
      style={{
        fontFamily: resolveFontFamily(settings.font_family),
        backgroundColor: settings.color_background,
      }}
    >
      <div className="mx-auto w-full max-w-7xl lg:grid lg:grid-cols-[1fr_min(24rem,100%)_1fr] lg:items-start lg:gap-6">
        <DesktopSideDecoration
          icon={settings.logo_icon}
          primaryColor={primary}
          accentColor={settings.color_accent}
        />
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-lg"
            style={{ backgroundColor: primary }}
          >
            <LogoIcon value={settings.logo_icon} className="h-10 w-10" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold sm:text-3xl" style={{ color: primary }}>
          {settings.hero_title}
        </h1>
        <p className="mt-2" style={{ color: settings.color_text }}>
          {settings.hero_subtitle}
        </p>

        <div className="mt-10">
          {activeQuiz ? (
            <Link
              href="/quiz"
              className="inline-flex w-full items-center justify-center rounded-full px-8 py-4 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
              style={{ backgroundColor: settings.color_accent }}
            >
              Commencer le quiz
            </Link>
          ) : (
            <p className="text-sm text-gray-400">
              Aucun quiz disponible aujourd&apos;hui. Reviens bientôt.
            </p>
          )}
        </div>

        <p className="mt-14 text-xs italic text-gray-400">« {verse.text} »</p>
        <p className="mt-1 text-xs font-semibold" style={{ color: accentDark }}>
          {verse.reference}
        </p>

        <div className="mt-16">
          <p className="text-xs text-gray-300">{settings.footer_text}</p>
          <Link
            href="/admin"
            className="mt-2 inline-block text-xs text-gray-200 hover:text-gray-400"
          >
            Espace admin
          </Link>
        </div>
      </div>
        <DesktopSideDecoration
          icon={settings.logo_icon}
          primaryColor={primary}
          accentColor={settings.color_accent}
          mirrored
        />
      </div>
    </main>
  );
}
