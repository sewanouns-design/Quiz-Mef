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

function ScriptureCard({
  reference,
  passages,
}: {
  reference: string;
  passages: Array<{
    reference: string;
    verses: Array<{ reference: string; text: string }>;
  }>;
}) {
  const heading = passages.length > 1 ? "Références bibliques" : passages[0]?.reference || reference || "Référence du jour";
  return (
    <section className="mt-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-2xl" aria-hidden="true">
          📖
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold text-navy sm:text-3xl">{heading}</h2>
          <p className="mt-2 text-sm font-semibold text-gray-500">Version Louis Second</p>
        </div>
      </div>

      {passages.length > 0 ? (
        <div className="mt-6 space-y-3">
          {passages.map((passage) => (
            <details key={passage.reference} className="group overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-extrabold text-navy marker:hidden [&::-webkit-details-marker]:hidden">
                <span>{passage.reference}</span>
                <span className="text-amber-700 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
              </summary>
              <div className="border-t border-amber-100 bg-white px-5 py-5">
                {passage.verses.length > 0 ? (
                  <blockquote className="border-l-4 border-amber-400 pl-5 text-base italic leading-7 text-slate-700 sm:text-lg sm:leading-8">
                    <div className="space-y-1">
                      {passage.verses.map((verse) => (
                        <p key={verse.reference} className="flex items-start gap-2">
                          <sup className="mt-0.5 min-w-5 text-right text-xs font-extrabold not-italic text-amber-700">{verse.reference.split(":").pop()}</sup>
                          <span>{verse.text}</span>
                        </p>
                      ))}
                    </div>
                  </blockquote>
                ) : (
                  <p className="text-base leading-8 text-slate-700">
                    Relis ce passage dans ta Bible, en version Louis Second.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-6 border-l-4 border-amber-400 pl-5 text-lg leading-9 text-slate-700">
          Relis le passage <strong>{reference}</strong> dans ta Bible, en version Louis Second, avant de continuer la méditation.
        </p>
      )}
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
                </div>
              </header>

              <ScriptureCard reference={lesson.reference} passages={lesson.scripturePassages} />

              <div className="mt-12">
                <SectionHeading icon="▌">Développement</SectionHeading>
                <p className="mt-6 whitespace-pre-line text-lg leading-9 text-slate-700 sm:text-xl sm:leading-10">
                  {lesson.body}
                </p>
              </div>

              {lesson.essential && (
                <section className="mt-12 rounded-3xl border border-blue-100 bg-blue-50/80 p-6 shadow-sm sm:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl" aria-hidden="true">✦</span>
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-blue-700">L&apos;essentiel</p>
                      <p className="mt-3 text-xl font-bold leading-9 text-slate-800">{lesson.essential}</p>
                    </div>
                  </div>
                </section>
              )}

              {lesson.prayer && (
                <InfoCard icon="🛡" title="Prière" className="mt-6">
                  <p className="border-l-4 border-purple-500 pl-5 italic text-slate-700">{lesson.prayer}</p>
                </InfoCard>
              )}

              <div className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm sm:p-8">
                <p className="text-lg font-semibold text-slate-700">Tu peux maintenant passer au quiz du jour.</p>
                <Link
                  href="/quiz"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-extrabold text-white shadow-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: settings.color_accent }}
                >
                  Passer le quiz du jour maintenant <span className="ml-2" aria-hidden="true">→</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
