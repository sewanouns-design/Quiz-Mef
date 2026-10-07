import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { getRandomVerse } from "@/lib/verses";
import { ALL_HOME_FONT_VARIABLES, resolveFontFamily } from "@/lib/fonts";
import LogoIcon from "@/components/LogoIcon";
import WeeklyQuizPopup from "./WeeklyQuizPopup";
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

export default function HomeCardTemplate({
  settings,
  activeQuiz,
  weeklyQuiz,
  stats,
  todayStats,
}: Props) {
  const primary = settings.color_primary;
  const primaryDark = settings.color_primary_dark;
  const accent = settings.color_accent;
  const secondary = settings.color_secondary;
  const verse = getRandomVerse();

  const titleClass = {
    normal: "text-2xl",
    large: "text-3xl",
    xlarge: "text-4xl",
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
      className={`flex min-h-screen items-center justify-center px-6 py-16 ${ALL_HOME_FONT_VARIABLES}`}
      style={{
        fontFamily: resolveFontFamily(settings.font_family),
        background: `linear-gradient(160deg, ${primary}, ${primaryDark})`,
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="px-8 pb-8 pt-10 text-center">
          <div
            className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl text-white shadow-md"
            style={{ backgroundColor: accent }}
          >
            <LogoIcon value={settings.logo_icon} className="h-12 w-12" />
          </div>

          <h1 className={`font-extrabold ${titleClass}`} style={{ color: primary }}>
            {settings.hero_title}
          </h1>
          <p className={`mt-2 ${subtitleClass}`} style={{ color: settings.color_text }}>
            {settings.hero_subtitle}
          </p>

          <div className="mt-8">
            {activeQuiz ? (
              <>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Quiz du jour
                </p>
                <p className="text-lg font-bold" style={{ color: primary }}>
                  {activeQuiz.title}
                </p>
                {activeQuiz.subtitle && (
                  <p className="mt-1 text-sm text-gray-500">{activeQuiz.subtitle}</p>
                )}
                <Link
                  href="/quiz"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-6 py-3 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  {settings.start_button_text}
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-400">
                Aucun quiz disponible aujourd&apos;hui. Reviens bientôt.
              </p>
            )}
            <Link
              href="/trouve-le-verset"
              className="mt-4 flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left shadow-sm transition-transform hover:scale-[1.02]"
              style={{
                borderColor: `${accent}50`,
                background: `linear-gradient(135deg, ${accent}1f, ${secondary}1f)`,
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-white shadow-sm"
                style={{ backgroundColor: accent }}
              >
                📖
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold" style={{ color: primary }}>
                  Trouve le verset
                </span>
                <span className="block text-xs text-gray-500">Jeu biblique · classement en direct</span>
              </span>
              <span className="shrink-0 text-lg" style={{ color: settings.color_accent_dark }}>
                →
              </span>
            </Link>
          </div>

          {activeQuiz && (
            <div className="mt-6">
              <LiveActivityTicker
                quizId={activeQuiz.id}
                activityPhrase={settings.activity_ticker_phrase}
              />
            </div>
          )}

          {settings.show_stats && stats.submissions > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-gray-100 pt-6 text-center">
              <div>
                <p className="text-lg font-extrabold" style={{ color: secondary }}>
                  {stats.participants}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {settings.stat_label_participants}
                </p>
              </div>
              <div>
                <p className="text-lg font-extrabold" style={{ color: secondary }}>
                  {stats.quizzes}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {settings.stat_label_quizzes}
                </p>
              </div>
              <div>
                <p className="text-lg font-extrabold" style={{ color: secondary }}>
                  {stats.submissions}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {settings.stat_label_submissions}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-4 text-center" style={{ backgroundColor: `${accent}0d` }}>
          <p className="text-xs italic" style={{ color: primary }}>
            « {verse.text} »
          </p>
          <p className="mt-1 text-xs font-semibold" style={{ color: settings.color_accent_dark }}>
            {verse.reference}
          </p>
        </div>
      </div>

      <WeeklyQuizPopup weeklyQuiz={weeklyQuiz} />
      </main>
    </>
  );
}
