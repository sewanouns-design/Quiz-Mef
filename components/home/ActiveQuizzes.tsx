import Link from "next/link";
import type { ActiveQuiz } from "@/lib/types";

interface Props {
  quizzes: ActiveQuiz[];
  primary: string;
  accent: string;
  accentDark: string;
  /** "minimal" : boutons arrondis et sobres, sans carte autour du quiz du jour. */
  variant?: "default" | "minimal";
}

const EMPTY_MESSAGE = "Aucun quiz disponible aujourd'hui. Reviens bientôt.";

function quizHref(quiz: ActiveQuiz): string {
  return `/quiz?quiz=${encodeURIComponent(quiz.id)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/**
 * Bloc des quiz disponibles sur la page d'accueil. Les quiz hebdomadaires
 * (récapitulatif de la semaine) sont mis en avant par une bannière très
 * visible ; les quiz quotidiens sont listés dessous. Plusieurs quiz peuvent
 * être actifs en même temps.
 */
export default function ActiveQuizzes({
  quizzes,
  primary,
  accent,
  accentDark,
  variant = "default",
}: Props) {
  const weekly = quizzes.filter((q) => q.quiz_type === "weekly");
  const daily = quizzes.filter((q) => q.quiz_type !== "weekly");

  if (quizzes.length === 0) {
    return variant === "minimal" ? (
      <p className="text-sm text-gray-400">{EMPTY_MESSAGE}</p>
    ) : (
      <div className="card">
        <p className="text-gray-600">{EMPTY_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      {weekly.map((quiz) => (
        <Link
          key={quiz.id}
          href={quizHref(quiz)}
          className="group relative block overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-transform hover:-translate-y-0.5"
          style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10"
          />
          <span className="relative inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            ⭐ Quiz de la semaine
          </span>
          <p className="relative mt-3 text-xl font-extrabold leading-snug">{quiz.title}</p>
          <p className="relative mt-1 text-sm text-white/85">
            Récapitulatif des leçons de la semaine
          </p>
          <span className="relative mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white px-6 py-3 font-bold text-navy transition-opacity group-hover:opacity-90">
            Participer maintenant →
          </span>
        </Link>
      ))}

      {daily.length === 1 && (
        <div className={variant === "minimal" ? "text-center" : "card"}>
          <p
            className="mb-1 text-sm font-semibold uppercase tracking-wide"
            style={{ color: accentDark }}
          >
            Quiz du jour
          </p>
          <p className="mb-5 text-xl font-bold" style={{ color: primary }}>
            {daily[0].title}
          </p>
          <Link
            href={quizHref(daily[0])}
            className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Commencer le quiz
          </Link>
        </div>
      )}

      {daily.length > 1 && (
        <div className={variant === "minimal" ? "text-center" : "card"}>
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-wide"
            style={{ color: accentDark }}
          >
            Quiz disponibles
          </p>
          <ul className="space-y-3">
            {daily.map((quiz) => (
              <li key={quiz.id}>
                <Link
                  href={quizHref(quiz)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0 text-left">
                    <span className="line-clamp-2 block font-semibold" style={{ color: primary }}>
                      {quiz.title}
                    </span>
                    <span className="block text-xs text-gray-400">{formatDate(quiz.lesson_date)}</span>
                  </span>
                  <span
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    Commencer
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
