import Link from "next/link";
import type { ActiveQuiz, SiteSettings } from "@/lib/types";
import { getRandomVerse } from "@/lib/verses";
import { ALL_HOME_FONT_VARIABLES, resolveFontFamily } from "@/lib/fonts";
import DesktopSideDecoration from "./DesktopSideDecoration";
import LogoIcon from "@/components/LogoIcon";
import ActiveQuizzes from "./ActiveQuizzes";

interface Props {
  settings: SiteSettings;
  activeQuizzes: ActiveQuiz[];
  stats: { participants: number; submissions: number; quizzes: number };
}

export default function HomeMinimalTemplate({ settings, activeQuizzes }: Props) {
  const primary = settings.color_primary;
  const accentDark = settings.color_accent_dark;
  const verse = getRandomVerse();

  return (
    <main
      className={`site-bg flex min-h-screen flex-col items-center justify-center px-6 py-16 ${ALL_HOME_FONT_VARIABLES}`}
      style={{
        fontFamily: resolveFontFamily(settings.font_family),
        backgroundColor: settings.color_background,
        ["--bg-primary" as string]: settings.color_primary,
        ["--bg-accent" as string]: settings.color_accent,
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
          <ActiveQuizzes
            quizzes={activeQuizzes}
            primary={primary}
            accent={settings.color_accent}
            accentDark={accentDark}
            variant="minimal"
          />
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
