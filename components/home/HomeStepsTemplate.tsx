import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { getRandomVerse } from "@/lib/verses";
import DesktopSideDecoration from "./DesktopSideDecoration";

interface Props {
  settings: SiteSettings;
  activeQuiz: { id: string; title: string; lesson_date: string } | null;
  stats: { participants: number; submissions: number; quizzes: number };
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

export default function HomeStepsTemplate({ settings, activeQuiz, stats }: Props) {
  const primary = settings.color_primary;
  const accentDark = settings.color_accent_dark;
  const secondary = settings.color_secondary;
  const verse = getRandomVerse();

  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{
        fontFamily: `'${settings.font_family}', sans-serif`,
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
              {settings.logo_icon}
            </div>
          </div>

          <h1 className="text-3xl font-extrabold sm:text-4xl" style={{ color: primary }}>
            {settings.hero_title}
          </h1>
          <p className="mt-3 text-lg" style={{ color: settings.color_text }}>
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
                <p className="mb-6 text-xl font-bold" style={{ color: primary }}>
                  {activeQuiz.title}
                </p>
                <Link
                  href="/quiz"
                  className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: settings.color_accent }}
                >
                  Commencer le quiz
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

        {settings.show_stats && stats.submissions > 0 && (
          <div className="mt-14 grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard value={stats.participants} label="Participants" primaryColor={secondary} />
            <StatCard value={stats.submissions} label="Quiz complétés" primaryColor={secondary} />
            <StatCard value={stats.quizzes} label="Leçons publiées" primaryColor={secondary} />
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
          <Link
            href="/admin"
            className="mt-2 inline-block text-xs text-gray-300 hover:text-gray-500"
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
