import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getSiteSettings } from "@/lib/site-settings";
import { getTodayLesson } from "@/lib/daily-lesson";

export const dynamic = "force-dynamic";

function SectionHeading({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl font-extrabold text-navy sm:text-3xl">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl" aria-hidden="true">
        {icon}
      </span>
      {children}
    </h2>
  );
}

function InfoCard({
  icon,
  title,
  children,
  className = "",
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8 ${className}`}>
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl" aria-hidden="true">
          {icon}
        </span>
        <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">{title}</h2>
      </div>
      <div className="mt-6 text-lg leading-9 text-slate-700">{children}</div>
    </section>
  );
}

export default async function LessonPage() {
  const [lesson, settings] = await Promise.all([getTodayLesson(), getSiteSettings()]);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#f7f9ff] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-base font-semibold text-blue-700 transition-colors hover:text-blue-900"
          >
            <span aria-hidden="true">←</span> Retour à l&apos;accueil
          </Link>

          {!lesson ? (
            <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">📖</div>
              <h1 className="mt-5 text-2xl font-extrabold text-navy">La leçon du jour arrive bientôt</h1>
              <p className="mx-auto mt-3 max-w-md leading-7 text-gray-600">
                La source pédagogique active ne contient pas encore de lecture pour aujourd&apos;hui.
                Tu peux tout de même consulter les quiz disponibles.
              </p>
              <Link href="/quiz" className="btn-primary mt-7">
                Voir les quiz
              </Link>
            </section>
          ) : (
            <>
              <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2d6be8] via-[#2559d7] to-[#2148b8] text-white shadow-xl">
                <div className="px-6 pb-9 pt-7 sm:px-10 sm:pb-12 sm:pt-9">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2.5 text-base font-bold backdrop-blur">
                    <span aria-hidden="true">▣</span>
                    {new Date(`${lesson.date}T12:00:00Z`).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-blue-100">
                    Leçon {lesson.lessonNumber}
                  </p>
                  <h1 className="mt-2 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                    {lesson.title.replace(/\s*\([^()]+\)\s*$/, "")}
                  </h1>
                  <p className="mt-4 text-base font-semibold text-blue-100 sm:text-lg">
                    {lesson.reference || "Lecture biblique du jour"}
                  </p>
                </div>
              </header>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/quiz"
                  className="order-1 inline-flex flex-1 items-center justify-center rounded-2xl px-6 py-4 text-base font-extrabold text-white shadow-lg transition-opacity hover:opacity-90 sm:order-2"
                  style={{ backgroundColor: settings.color_accent }}
                >
                  Passer le quiz du jour <span className="ml-2" aria-hidden="true">→</span>
                </Link>
                <span className="order-2 inline-flex flex-1 items-center justify-center rounded-2xl border border-blue-200 bg-white px-6 py-4 text-center text-sm font-semibold text-blue-800 sm:order-1">
                  Lis d&apos;abord attentivement la leçon
                </span>
              </div>

              {lesson.essential && (
                <section className="mt-8 rounded-3xl border border-blue-100 bg-blue-50/80 p-6 shadow-sm sm:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl" aria-hidden="true">✦</span>
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-blue-700">L&apos;essentiel</p>
                      <p className="mt-3 text-xl font-bold leading-9 text-slate-800">{lesson.essential}</p>
                    </div>
                  </div>
                </section>
              )}

              <div className="mt-12">
                <SectionHeading icon="▌">Développement</SectionHeading>
                <p className="mt-6 whitespace-pre-line text-lg leading-9 text-slate-700 sm:text-xl sm:leading-10">
                  {lesson.body}
                </p>
              </div>

              <div className="my-12 border-t border-gray-200" />

              <InfoCard icon="📖" title="Références bibliques">
                <p className="font-bold text-navy">{lesson.reference || lesson.title}</p>
                <p className="mt-3 text-base leading-8 text-slate-600">
                  Relis attentivement le passage indiqué avant de commencer le quiz. Les questions portent sur la compréhension précise de la leçon et de son contenu.
                </p>
              </InfoCard>

              {lesson.prayer && (
                <InfoCard icon="🛡" title="Prière" className="mt-6">
                  <p className="border-l-4 border-purple-500 pl-5 italic text-slate-700">{lesson.prayer}</p>
                </InfoCard>
              )}

              {lesson.annualReading && (
                <section className="mt-6 rounded-3xl border border-amber-100 bg-amber-50/70 p-6 sm:p-8">
                  <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-amber-700">Lecture biblique annuelle</p>
                  <p className="mt-3 text-base font-semibold leading-8 text-slate-700">{lesson.annualReading}</p>
                </section>
              )}

              <div className="mt-12 border-t border-gray-200 pt-8 text-center">
                <p className="text-base font-semibold text-slate-600">Que cette méditation vous bénisse.</p>
                <Link
                  href="/quiz"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-amber-100 px-7 py-3.5 font-extrabold text-amber-800 transition-colors hover:bg-amber-200"
                >
                  Compris, je passe au quiz <span className="ml-2" aria-hidden="true">↓</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
