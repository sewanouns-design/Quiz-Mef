"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateDeviceKey } from "@/lib/participant-storage";
import SiteHeader from "@/components/SiteHeader";
import type { CorrectedAnswer } from "@/lib/types";

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
  passRatePercent?: number | null;
  attemptsCount?: number;
  trainingAttemptsCount?: number;
  categoryCounts?: { daily: number; weekly: number; quarterly: number };
  averagePercent?: number | null;
  bestScorePercent?: number | null;
  pedagogicalBestPercent?: number | null;
  streakDays?: number;
  history?: HistoryEntry[];
}

interface ResultDetail {
  quiz: { id: string; title: string };
  participantName: string;
  score: number;
  maxScore: number;
  cancelled: boolean;
  attemptNumber: number;
  officialScore: number | null;
  officialMaxScore: number | null;
  isOfficialAttempt: boolean;
  answers: CorrectedAnswer[];
}

function StatCard({ icon, value, label, tone = "default" }: { icon: string; value: string | number; label: string; tone?: "default" | "green" | "blue" }) {
  const toneClass = tone === "green"
    ? "border-green-200 bg-green-50"
    : tone === "blue"
      ? "border-blue-200 bg-blue-50"
      : "border-gray-200 bg-white";
  return (
    <div className={`rounded-2xl border px-4 py-5 text-center shadow-sm ${toneClass}`}>
      <p className="text-2xl" aria-hidden="true">{icon}</p>
      <p className="mt-2 text-2xl font-extrabold text-navy">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
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

function selectedAnswer(answer: CorrectedAnswer): string {
  if (answer.type === "mcq" || answer.type === "true_false") {
    if (answer.participantSelectedOption === null) return "Pas de réponse";
    return answer.options?.[answer.participantSelectedOption] ?? "—";
  }
  return answer.participantAnswerText || "Pas de réponse";
}

function correctAnswer(answer: CorrectedAnswer): string {
  if (answer.type === "mcq" || answer.type === "true_false") {
    if (answer.correctOption === null) return "—";
    return answer.options?.[answer.correctOption] ?? "—";
  }
  return answer.correctText || "—";
}

function DetailAnswer({ answer, index }: { answer: CorrectedAnswer; index: number }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold leading-6 text-navy">
          {answer.isCorrect === true ? "✅" : answer.isCorrect === false ? "❌" : "•"} {index + 1}. {answer.question}
        </h3>
        <span className="shrink-0 rounded-full bg-navy/10 px-2.5 py-1 text-xs font-bold text-navy">
          {answer.pointsAwarded}/{answer.points} pt
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-gray-700">
        <p><strong>Ta réponse :</strong> {selectedAnswer(answer)}</p>
        {answer.isCorrect === false && answer.correctOption === null && answer.correctText === null ? (
          <p className="italic text-gray-400">La correction sera révélée après une nouvelle tentative.</p>
        ) : (
          <p><strong>Bonne réponse :</strong> {correctAnswer(answer)}</p>
        )}
        {answer.justification && (
          <p className="rounded-xl bg-navy/5 p-3 text-gray-600"><strong>Explication :</strong> {answer.justification}</p>
        )}
      </div>
    </article>
  );
}

export default function MesStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const deviceKey = getOrCreateDeviceKey();
    fetch(`/api/participant/stats?deviceKey=${encodeURIComponent(deviceKey)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Impossible de charger ton tableau de bord.");
        }
        return res.json();
      })
      .then((json: StatsData) => setData(json))
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focusedQuizId = params.get("quizId");
    const focusedToken = params.get("token");
    if (!focusedQuizId || !focusedToken) return;
    fetch(`/api/quiz/${encodeURIComponent(focusedQuizId)}/results/${encodeURIComponent(focusedToken)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || "Impossible de charger le détail de cette tentative.");
        }
        return res.json();
      })
      .then((json: ResultDetail) => setDetail(json))
      .catch((err) => setDetailError(err instanceof Error ? err.message : "Détail indisponible."));
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#f7f9ff] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-dark">Espace apprenant</p>
            <h1 className="mt-2 text-3xl font-black text-navy sm:text-4xl">Mon tableau de bord</h1>
            {data?.participant?.name && <p className="mt-2 text-gray-600">Bonjour, {data.participant.name}.</p>}
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Retrouve ici tes résultats, ta note officielle, tes reprises d&apos;entraînement et ta progression.
            </p>
          </div>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-700">{error}</p>}
          {!error && data === null && <p className="text-center text-gray-500">Chargement de ton tableau de bord...</p>}

          {data && !data.participant && (
            <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
              <p className="text-4xl" aria-hidden="true">📊</p>
              <h2 className="mt-3 text-xl font-extrabold text-navy">Ton tableau de bord est prêt</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">Commence un quiz pour voir apparaître ton historique et tes statistiques.</p>
              <Link href="/quiz" className="btn-primary mt-6">Voir les quiz</Link>
            </section>
          )}

          {data?.participant && (
            <>
              <section className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-extrabold text-navy">Comment lire tes résultats ?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  La <strong>note officielle</strong> est celle de ta première tentative non annulée. Elle compte pour ta progression et, si le quiz est concerné, pour le classement trimestriel. Les tentatives suivantes sont des <strong>reprises d&apos;entraînement</strong> : elles t&apos;aident à apprendre, mais ne remplacent pas la note officielle.
                </p>
              </section>

              <section className="mt-6">
                <h2 className="mb-3 text-xl font-extrabold text-navy">Vue d&apos;ensemble</h2>
                {(data.quizzesCount ?? 0) === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
                    Tu n&apos;as pas encore soumis de quiz. Tes statistiques apparaîtront après ta première tentative.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard icon="📝" value={data.quizzesCount ?? 0} label="Quiz passés" />
                    <StatCard icon="✅" value={data.passedCount ?? 0} label="Réussites officielles" tone="green" />
                    <StatCard icon="📊" value={data.averagePercent !== null && data.averagePercent !== undefined ? `${data.averagePercent}%` : "—"} label="Moyenne officielle" />
                    <StatCard icon="🏆" value={data.bestScorePercent !== null && data.bestScorePercent !== undefined ? `${data.bestScorePercent}%` : "—"} label="Meilleure note officielle" tone="green" />
                    <StatCard icon="🎯" value={data.passRatePercent !== null && data.passRatePercent !== undefined ? `${data.passRatePercent}%` : "—"} label="Taux de réussite" tone="blue" />
                    <StatCard icon="🔁" value={data.trainingAttemptsCount ?? 0} label="Reprises d&apos;entraînement" tone="blue" />
                    <StatCard icon="📚" value={data.categoryCounts?.daily ?? 0} label="Quiz quotidiens" />
                    <StatCard icon="🔥" value={`${data.streakDays ?? 0} j`} label="Série actuelle" tone="blue" />
                  </div>
                )}
              </section>

              {(data.quizzesCount ?? 0) > 0 && (
                <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-extrabold text-navy">Répartition de ta participation</h2>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-blue-50 p-4"><p className="text-2xl font-black text-blue-800">{data.categoryCounts?.daily ?? 0}</p><p className="mt-1 text-xs font-bold text-blue-700">Quotidiens</p></div>
                    <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-2xl font-black text-indigo-800">{data.categoryCounts?.weekly ?? 0}</p><p className="mt-1 text-xs font-bold text-indigo-700">Hebdomadaires</p></div>
                    <div className="rounded-2xl bg-amber-50 p-4"><p className="text-2xl font-black text-amber-800">{data.categoryCounts?.quarterly ?? 0}</p><p className="mt-1 text-xs font-bold text-amber-700">Trimestriels</p></div>
                  </div>
                  <p className="mt-4 text-sm text-gray-600">Nombre total de tentatives enregistrées : <strong>{data.attemptsCount ?? 0}</strong>.</p>
                </section>
              )}

              {detail && (
                <section className="mt-8 rounded-3xl border-2 border-accent/20 bg-accent/5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-accent-dark">Détail de la tentative</p>
                      <h2 className="mt-1 text-xl font-extrabold text-navy">{detail.quiz.title}</h2>
                    </div>
                    <Link href="/mes-stats" className="text-sm font-semibold text-accent-dark hover:underline">Fermer le détail</Link>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase text-gray-500">Note obtenue</p><p className="mt-1 text-2xl font-black text-navy">{detail.score}/{detail.maxScore}</p></div>
                    <div className="rounded-2xl bg-white p-4"><p className="text-xs font-bold uppercase text-gray-500">Statut</p><p className="mt-1 text-lg font-extrabold text-navy">{detail.cancelled ? "Annulée" : detail.isOfficialAttempt ? "Officielle" : "Entraînement"}</p></div>
                  </div>
                  {!detail.cancelled && !detail.isOfficialAttempt && detail.officialScore !== null && (
                    <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Ta note officielle reste <strong>{detail.officialScore}/{detail.officialMaxScore}</strong>.</p>
                  )}
                  <div className="mt-5 space-y-3">
                    {detail.answers.map((answer, index) => <DetailAnswer key={answer.questionId} answer={answer} index={index} />)}
                  </div>
                </section>
              )}
              {detailError && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{detailError}</p>}

              {data.history && data.history.length > 0 && (
                <section className="mt-8">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-navy">Historique des quiz</h2>
                      <p className="mt-1 text-sm text-gray-600">Ouvre un quiz pour afficher toutes ses réponses et explications ici.</p>
                    </div>
                  </div>
                  <ul className="space-y-4">
                    {data.history.map((h) => (
                      <li key={h.quizId} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-navy">{h.quizTitle}</p>
                            {h.quizSubtitle && <p className="mt-1 text-xs text-gray-500">{h.quizSubtitle}</p>}
                            <span className="mt-2 inline-flex rounded-full bg-navy/5 px-2.5 py-1 text-[11px] font-semibold text-navy">{categoryLabel(h.category)}</span>
                          </div>
                          <Link href={`/mes-stats?quizId=${encodeURIComponent(h.quizId)}&token=${encodeURIComponent(h.official.resultToken)}`} className="shrink-0 rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white hover:opacity-90">Voir le détail</Link>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border-2 border-green-200 bg-green-50 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-green-700">Note officielle</p>
                            <p className="mt-1 text-xl font-extrabold text-green-900">{h.official.score}/{h.official.maxScore} <span className="text-xs">({scorePercent(h.official.score, h.official.maxScore)}%)</span></p>
                            <p className="mt-1 text-xs text-green-800">{formatDate(h.official.submittedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Entraînement</p>
                            {h.training.length === 0 ? <p className="mt-2 text-sm font-semibold text-blue-900">Aucune reprise</p> : <p className="mt-2 text-sm font-semibold text-blue-900">{h.training.length} reprise{h.training.length > 1 ? "s" : ""} · meilleure note {Math.max(...h.training.map((attempt) => scorePercent(attempt.score, attempt.maxScore)))}%</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/quiz" className="btn-primary">Voir les quiz</Link>
            <Link href="/" className="btn-secondary">Retour à l&apos;accueil</Link>
          </div>
        </div>
      </main>
    </>
  );
}
