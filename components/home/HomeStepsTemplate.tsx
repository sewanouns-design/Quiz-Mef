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

function StatCard({
  value,
  label,
  primaryColor,
}: {
  value: number;
  label: string;
  primaryColor: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-center shadow-sm">
      <p className="text-2xl font-extrabold sm:text-3xl" style={{ color: primaryColor }}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

export default function HomeStepsTemplate({
  settings,
  activeQuiz,
  weeklyQuiz,
  stats,
  todayStats,
}: Props) {
  const primary = settings.color_primary;
  const accentDark = settings.color_accent_dark;
  const secondary = settings.color_secondary;
  const verse = getRandomVerse();

  const titleClass = {
    normal: "text-3xl sm:text-4xl",
    large: "text-4xl sm:text-5xl",
    xlarge: "text-5xl sm:text-6xl",
  }[settings.text_size];
  const subtitleClass = {
    normal: "text-lg",
    large: "text-xl",
    xlarge: "text-2xl",
  }[settings.text_size];

  return (
    <>
      <HomeTopBar settings={settings} todayStats={todayStats} />
      <main
      className={`min-h-screen px-6 py-16 ${ALL_HOME_FONT_VARIABLES}`}
      style={{
        fontFamily: resolveFontFamily(settings.font_family),
        backgroundColor: settings.color_background,
      }}
    >
      <div className="mx-auto w-full max-w-7xl lg:grid lg:grid-cols-[1fr_min(42rem,100%)_1fr] lg:items-start lg:gap-6">
        <DesktopSideDecoration
          icon={settings.logo_icon}
          primaryColor={primary}
          accentColor={settings.color_accent}
        />
        <div className="mx-auto w-full max-w-2xl">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl shadow-lg"
              style={{ backgroundColor: primary }}
            >
              <LogoIcon value={settings.logo_icon} className="h-12 w-12" />
            </div>
          </div>

          <h1 className={`font-extrabold ${titleClass}`} style={{ color: primary }}>
            {settings.hero_title}
          </h1>
          <p className={`mt-3 ${subtitleClass}`} style={{ color: settings.color_text }}>
            {settings.hero_subtitle}
          </p>

          <div className="mx-auto mt-10 max-w-md">
            {activeQuiz ? (
              <div className="card">
                <p
                  className="mb-1 text-sm font-semibold uppercase tracking-wide"
                  style={{ color: accentDark }}
                >
                  Quiz du jour
                </p>
                <p className="text-xl font-bold" style={{ color: primary }}>
                  {activeQuiz.title}
                </p>
                {activeQuiz.subtitle && (
                  <p className="mt-1 text-sm text-gray-500">{activeQuiz.subtitle}</p>
                )}
                <Link
                  href="/quiz"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: settings.color_accent }}
                >
                  {settings.start_button_text}
                </Link>
              </div>
            ) : (
              <div className="card">
                <p className="text-gray-600">
                  Aucun quiz disponible aujourd&apos;hui. Reviens bientôt.
                </p>
              </div>
            )}
          </div>
        </div>

        {activeQuiz && (
          <div className="mx-auto mt-10 max-w-xl">
            <LiveActivityTicker
              quizId={activeQuiz.id}
              activityPhrase={settings.activity_ticker_phrase}
            />
          </div>
        )}

        {settings.show_stats && stats.submissions > 0 && (
          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              value={stats.participants}
              label={settings.stat_label_participants}
              primaryColor={secondary}
            />
            <StatCard
              value={stats.quizzes}
              label={settings.stat_label_quizzes}
              primaryColor={secondary}
            />
            <StatCard
              value={stats.submissions}
              label={settings.stat_label_submissions}
              primaryColor={secondary}
            />
          </div>
        )}

        <div className="mt-16">
          <h2
            className="text-center text-sm font-semibold uppercase tracking-wide"
            style={{ color: accentDark }}
          >
            Comment ça marche
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {settings.steps.map((step, index) => (
              <div key={step.title} className="card text-center">
                <div className="mb-3 flex justify-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                    style={{ backgroundColor: `${primary}1a` }}
                  >
                    {step.icon}
                  </div>
                </div>
                <p className="text-xs font-semibold" style={{ color: accentDark }}>
                  Étape {index + 1}
                </p>
                <p className="mt-1 font-bold" style={{ color: primary }}>
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mx-auto mt-10 max-w-md rounded-xl border px-4 py-3 text-center"
          style={{
            borderColor: `${settings.color_accent}40`,
            backgroundColor: `${settings.color_accent}0d`,
          }}
        >
          <p className="text-sm" style={{ color: primary }}>
            « {verse.text} »
          </p>
          <p className="mt-1 text-xs font-semibold" style={{ color: accentDark }}>
            {verse.reference}
          </p>
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs text-gray-400">{settings.footer_text}</p>
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
