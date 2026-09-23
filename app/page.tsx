import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getActiveQuiz() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date")
    .eq("is_active", true)
    .order("lesson_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur récupération quiz actif :", error.message);
    return null;
  }
  return data;
}

async function getStats() {
  const supabase = getSupabaseAdmin();

  const [participants, submissions, quizzes] = await Promise.all([
    supabase.from("participants").select("*", { count: "exact", head: true }),
    supabase.from("daily_submissions").select("*", { count: "exact", head: true }),
    supabase.from("daily_quizzes").select("*", { count: "exact", head: true }),
  ]);

  return {
    participants: participants.count ?? 0,
    submissions: submissions.count ?? 0,
    quizzes: quizzes.count ?? 0,
  };
}

const STEPS = [
  {
    icon: "📝",
    title: "Identifie-toi",
    description: "Ton nom et ta paroisse suffisent pour commencer.",
  },
  {
    icon: "⁉️",
    title: "Réponds au quiz",
    description: "Des questions sur la leçon du jour, à ton rythme.",
  },
  {
    icon: "📊",
    title: "Reçois tes résultats",
    description: "Score détaillé, corrections, et un email récapitulatif.",
  },
];

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-center shadow-sm">
      <p className="text-2xl font-extrabold text-navy sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

export default async function HomePage() {
  const [activeQuiz, stats] = await Promise.all([getActiveQuiz(), getStats()]);

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto w-full max-w-2xl">
        {/* Hero */}
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy text-4xl shadow-lg">
              ⁉️
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-navy sm:text-4xl">
            Quiz Biblique du Jour
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Teste tes connaissances sur la leçon du jour
          </p>

          <div className="mt-10 mx-auto max-w-md">
            {activeQuiz ? (
              <div className="card">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-accent-dark">
                  Quiz du jour
                </p>
                <p className="mb-6 text-xl font-bold text-navy">{activeQuiz.title}</p>
                <Link href="/quiz" className="btn-accent w-full">
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

        {/* Stats */}
        {stats.submissions > 0 && (
          <div className="mt-14 grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard value={stats.participants} label="Participants" />
            <StatCard value={stats.submissions} label="Quiz complétés" />
            <StatCard value={stats.quizzes} label="Leçons publiées" />
          </div>
        )}

        {/* Comment ça marche */}
        <div className="mt-16">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-accent-dark">
            Comment ça marche
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="card text-center">
                <div className="mb-3 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/10 text-xl">
                    {step.icon}
                  </div>
                </div>
                <p className="text-xs font-semibold text-accent-dark">Étape {index + 1}</p>
                <p className="mt-1 font-bold text-navy">{step.title}</p>
                <p className="mt-1 text-sm text-gray-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Verset d'encouragement */}
        <div className="mt-16 rounded-2xl border-2 border-accent/40 bg-accent/5 px-6 py-8 text-center">
          <p className="text-navy">
            « Sonde les écritures, car ce sont elles qui rendent témoignage de moi. »
          </p>
          <p className="mt-2 text-sm font-semibold text-accent-dark">Jean 5:39</p>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-gray-400">
            Quiz Biblique MEF — Mission Évangélique de la Foi
          </p>
          <Link
            href="/admin"
            className="mt-2 inline-block text-xs text-gray-300 hover:text-gray-500"
          >
            Espace admin
          </Link>
        </div>
      </div>
    </main>
  );
}
