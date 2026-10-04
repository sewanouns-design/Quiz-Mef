import Link from "next/link";
import type { ActiveQuiz, SiteSettings } from "@/lib/types";
import { getRandomVerse } from "@/lib/verses";
import { ALL_HOME_FONT_VARIABLES, resolveFontFamily } from "@/lib/fonts";
import LogoIcon from "@/components/LogoIcon";
import ActiveQuizzes from "./ActiveQuizzes";

interface Props {
  settings: SiteSettings;
  activeQuizzes: ActiveQuiz[];
  stats: { participants: number; submissions: number; quizzes: number };
}

export default function HomeCardTemplate({ settings, activeQuizzes, stats }: Props) {
  const primary = settings.color_primary;
  const primaryDark = settings.color_primary_dark;
  const accent = settings.color_accent;
  const secondary = settings.color_secondary;
  const verse = getRandomVerse();

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-6 py-16 ${ALL_HOME_FONT_VARIABLES}`}
      style={{
        fontFamily: resolveFontFamily(settings.font_family),
        backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), radial-gradient(45rem 32rem at 100% 100%, ${accent}33, transparent 70%), linear-gradient(160deg, ${primary}, ${primaryDark})`,
        backgroundSize: "22px 22px, auto, auto",
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

          <h1 className="text-2xl font-extrabold" style={{ color: primary }}>
            {settings.hero_title}
          </h1>
          <p className="mt-2" style={{ color: settings.color_text }}>
            {settings.hero_subtitle}
          </p>

          <div className="mt-8">
            <ActiveQuizzes
              quizzes={activeQuizzes}
              primary={primary}
              accent={accent}
              accentDark={settings.color_accent_dark}
              variant="minimal"
            />
          </div>

          {settings.show_stats && stats.submissions > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-2 border-t border-gray-100 pt-6 text-center">
              <div>
                <p className="text-lg font-extrabold" style={{ color: secondary }}>
                  {stats.participants}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Participants</p>
              </div>
              <div>
                <p className="text-lg font-extrabold" style={{ color: secondary }}>
                  {stats.submissions}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Quiz faits</p>
              </div>
              <div>
                <p className="text-lg font-extrabold" style={{ color: secondary }}>
                  {stats.quizzes}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Leçons</p>
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

      <Link
        href="/admin"
        className="fixed bottom-4 right-4 text-xs text-white/40 hover:text-white/70"
      >
        Espace admin
      </Link>
    </main>
  );
}
