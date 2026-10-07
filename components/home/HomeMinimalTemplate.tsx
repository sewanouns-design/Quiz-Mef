import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { getRandomVerse } from "@/lib/verses";
import { ALL_HOME_FONT_VARIABLES, resolveFontFamily } from "@/lib/fonts";
import DesktopSideDecoration from "./DesktopSideDecoration";
import WeeklyQuizPopup from "./WeeklyQuizPopup";
import LogoIcon from "@/components/LogoIcon";
import type { TodayStats } from "./todayStats";
import LiveActivityTicker from "./LiveActivityTicker";
import HomeTopBar from "./HomeTopBar";

interface Props {
  settings: SiteSettings;
  activeQuiz: { id: string; title: string; subtitle: string | null } | null;
  weeklyQuiz: { id: string; title: string; subtitle: string | null } | null;
  stats: { participants: number; submissions: number; quizzes: number };
  todayStats: TodayStats | null;
}

export default function HomeMinimalTemplate({ settings, activeQuiz, weeklyQuiz, todayStats }: Props) {
  const primary = settings.color_primary;
  const accentDark = settings.color_accent_dark;
  const verse = getRandomVerse();

  const titleClass = {
    normal: "text-2xl sm:text-3xl",
    large: "text-3xl sm:text-4xl",
    xlarge: "text-4xl sm:text-5xl",
  }[settings.text_size];
  const subtitleClass = {
    normal: "text-base",
    large: "text-lg",
    xlarge: "text-xl",
  }[settings.text_size];

  return (
    <>
      <HomeTopBar settings={settings} todayStats={todayStats} />
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

        <h1 className={`font-extrabold ${titleClass}`} style={{ color: primary }}>
          {settings.hero_title}
        </h1>
        <p className={`mt-2 ${subtitleClass}`} style={{ color: settings.color_text }}>
          {settings.hero_subtitle}
        </p>

        <div className="mt-10">
          {activeQuiz ? (
            <>
              <Link
                href="/quiz"
                className="inline-flex w-full items-center justify-center rounded-full px-8 py-4 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                style={{ backgroundColor: settings.color_accent }}
              >
                {settings.start_button_text}
              </Link>
              <div className="mt-4">
                <LiveActivityTicker
                  quizId={activeQuiz.id}
                  activityPhrase={settings.activity_ticker_phrase}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              Aucun quiz disponible aujourd&apos;hui. Reviens bientôt.
            </p>
          )}
          <Link
            href="/trouve-le-verset"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 px-8 py-4 text-base font-semibold transition-colors hover:bg-white"
            style={{ borderColor: settings.color_secondary, color: settings.color_secondary }}
          >
            📖 Jeu : Trouve le verset
          </Link>
        </div>

        <p className="mt-14 text-xs italic text-gray-400">« {verse.text} »</p>
        <p className="mt-1 text-xs font-semibold" style={{ color: accentDark }}>
          {verse.reference}
        </p>

        <div className="mt-16">
          <p className="text-xs text-gray-300">{settings.footer_text}</p>
        </div>
      </div>
        <DesktopSideDecoration
          icon={settings.logo_icon}
          primaryColor={primary}
          accentColor={settings.color_accent}
          mirrored
        />
      </div>
      <WeeklyQuizPopup weeklyQuiz={weeklyQuiz} />
      </main>
    </>
  );
}
