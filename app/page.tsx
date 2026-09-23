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

export default async function HomePage() {
  const activeQuiz = await getActiveQuiz();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
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

        <div className="mt-10">
          {activeQuiz ? (
            <div className="card">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-gold-dark">
                Quiz du jour
              </p>
              <p className="mb-6 text-xl font-bold text-navy">{activeQuiz.title}</p>
              <Link href="/quiz" className="btn-gold w-full">
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

        <p className="mt-12 text-xs text-gray-400">
          Quiz Biblique MEF — Mission Évangélique de la Foi
        </p>
      </div>
    </main>
  );
}
