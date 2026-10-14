"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateDeviceKey } from "@/lib/participant-storage";
import SiteHeader from "@/components/SiteHeader";

interface HistoryEntry {
  quizId: string;
  quizTitle: string;
  quizSubtitle: string | null;
  category: "daily" | "weekly" | "quarterly";
  official: {
    score: number;
    maxScore: number;
    submittedAt: string;
    resultToken: string;
  };
  training: Array<{
    score: number;
    maxScore: number;
    attemptNumber: number;
    submittedAt: string;
    resultToken: string;
  }>;
  latestSubmittedAt: string;
}

interface StatsData {
  participant: { name: string } | null;
  quizzesCount?: number;
  passedCount?: number;
  averagePercent?: number | null;
  bestScorePercent?: number | null;
  pedagogicalBestPercent?: number | null;
  streakDays?: number;
  history?: HistoryEntry[];
}

function StatCard({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-5 text-center shadow-sm">
      <p className="text-3xl">{icon}</p>
      <p className="mt-2 text-2xl font-extrabold text-navy">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function categoryLabel(category: HistoryEntry["category"]): string {
  if (category === "weekly") return "Hebdomadaire";
  if (category === "quarterly") return "Examen trimestriel";
  return "Quotidien";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scorePercent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

export default function MesStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const deviceKey = getOrCreateDeviceKey();
    fetch(`/api/participant/stats?deviceKey=${encodeURIComponent(deviceKey)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Impossible de charger tes statistiques.");
        }
        return res.json();
      })
      .then((json: StatsData) => setData(json))
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-navy">📊 Mes stats</h1>
            {data?.participant?.name && (
              <p className="mt-1 text-gray-500">Bonjour, {data.participant.name}.</p>
            )}
          </div>

          {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}

          {!error && data === null && <p className="text-center text-gray-500">Chargement...</p>}

          {data && !data.participant && (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Aucune donnée sur cet appareil pour le moment. Commence un quiz pour voir tes
              statistiques apparaître ici.
            </p>
          )}

          {data?.participant && data.quizzesCount === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Tu n&apos;as pas encore soumis de quiz. Reviens ici après ta première tentative !
            </p>
          )}

          {data?.participant && (data.quizzesCount ?? 0) > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="📝" value={data.quizzesCount ?? 0} label="Quiz suivis" />
              <StatCard icon="✅" value={data.passedCount ?? 0} label="Réussis officiellement" />
              <StatCard
                icon="📊"
                value={data.averagePercent !== null && data.averagePercent !== undefined ? `${data.averagePercent}%` : "—"}
                label="Moyenne officielle"
              />
              <StatCard
                icon="🏆"
                value={
                  data.bestScorePercent !== null && data.bestScorePercent !== undefined
                    ? `${data.bestScorePercent}%`
                    : "—"
                }
                label="Meilleure note officielle"
              />
              <div className="col-span-2">
                <StatCard
                  icon="📈"
                  value={
                    data.pedagogicalBestPercent !== null && data.pedagogicalBestPercent !== undefined
                      ? `${data.pedagogicalBestPercent}%`
                      : "—"
                  }
                  label="Meilleure note obtenue en entraînement"
                />
              </div>
              {(data.streakDays ?? 0) >= 2 && (
                <div className="col-span-2">
                  <StatCard icon="🔥" value={`${data.streakDays} jours`} label="Série officielle en cours" />
                </div>
              )}
            </div>
          )}

          {data?.history && data.history.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Historique officiel et pédagogique
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-gray-600">
                La note officielle est toujours celle de la première tentative non annulée. Les autres notes restent visibles comme reprises pédagogiques.
              </p>
              <ul className="space-y-4">
                {data.history.map((h) => (
                  <li key={h.quizId}>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-navy">{h.quizTitle}</p>
                          {h.quizSubtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{h.quizSubtitle}</p>}
                          <span className="mt-2 inline-flex rounded-full bg-navy/5 px-2.5 py-1 text-[11px] font-semibold text-navy">
                            {categoryLabel(h.category)}
                          </span>
                        </div>
                        <Link
                          href={`/quiz/${h.quizId}/resultats/${h.official.resultToken}`}
                          className="shrink-0 text-xs font-semibold text-accent-dark hover:underline"
                        >
                          Détails
                        </Link>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border-2 border-green-200 bg-green-50 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-green-700">Note officielle</p>
                          <p className="mt-1 text-xl font-extrabold text-green-900">
                            {h.official.score}/{h.official.maxScore}
                            <span className="ml-1 text-xs font-semibold">({scorePercent(h.official.score, h.official.maxScore)}%)</span>
                          </p>
                          <p className="mt-1 text-[11px] text-green-800">{formatDate(h.official.submittedAt)}</p>
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Notes de reprise</p>
                          {h.training.length === 0 ? (
                            <p className="mt-2 text-sm font-semibold text-blue-900">Aucune</p>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {h.training.map((attempt) => (
                                <Link
                                  key={attempt.resultToken}
                                  href={`/quiz/${h.quizId}/resultats/${attempt.resultToken}`}
                                  className="block text-sm font-bold text-blue-900 hover:underline"
                                >
                                  {attempt.score}/{attempt.maxScore}{" "}
                                  <span className="text-xs font-medium">(essai {attempt.attemptNumber})</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/" className="btn-secondary">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
