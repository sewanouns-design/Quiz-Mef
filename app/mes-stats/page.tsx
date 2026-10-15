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
  quiz: { id: string; title: string; category?: "daily" | "weekly" | "quarterly" };
  participantName: string;
  score: number;
  maxScore: number;
  cancelled: boolean;
  attemptNumber: number;
  officialScore: number | null;
  officialMaxScore: number | null;
  isOfficialAttempt: boolean;
  showAnswerReview: boolean;
  answerReviewMessage: string | null;
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

function ResultDetailModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: ResultDetail | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!detail && !loading && !error) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detail, loading, error, onClose]);

  if (!detail && !loading && !error) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/65 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-detail-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-[#f7f9ff] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 bg-navy px-5 py-4 text-white sm:px-7">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">Détail du résultat</p>
            <h2 id="result-detail-title" className="mt-1 truncate text-lg font-extrabold sm:text-xl">
              {detail?.quiz.title ?? "Chargement du résultat…"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-lg leading-none text-white hover:bg-white/20" aria-label="Fermer le détail">×</button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-7">
          {loading && <p className="py-10 text-center text-sm text-gray-500">Chargement du détail…</p>}
          {!loading && error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
          {!loading && !error && detail && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-green-700">Note obtenue</p><p className="mt-1 text-2xl font-black text-green-900">{detail.score}/{detail.maxScore}</p></div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Statut</p><p className="mt-1 text-base font-extrabold text-blue-900">{detail.cancelled ? "Annulée" : detail.isOfficialAttempt ? "Officielle" : "Entraînement"}</p></div>
              </div>
              {!detail.cancelled && !detail.isOfficialAttempt && detail.officialScore !== null && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Ta note officielle reste <strong>{detail.officialScore}/{detail.officialMaxScore}</strong>.</p>}
              {detail.showAnswerReview ? (
                <div className="mt-5 space-y-3"><p className="text-sm font-bold text-navy">Réponses et explications</p>{detail.answers.map((answer, index) => <DetailAnswer key={answer.questionId} answer={answer} index={index} />)}</div>
              ) : (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">🔒 {detail.answerReviewMessage || "La correction détaillée n'est pas disponible pour cette tentative."}</p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-white px-4 py-3 sm:px-7"><button type="button" onClick={onClose} className="btn-primary">Fermer</button></div>
      </div>
    </div>
  );
}

export default function MesStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  async function openDetail(quizId: string, token: string) {
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/quiz/${encodeURIComponent(quizId)}/results/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Impossible de charger le détail de cette tentative.");
      setDetail(json as ResultDetail);
      window.history.replaceState({}, "", `/mes-stats?quizId=${encodeURIComponent(quizId)}&token=${encodeURIComponent(token)}`);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Détail indisponible.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    window.history.replaceState({}, "", "/mes-stats");
  }

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

              {data.history && data.history.length > 0 && (
                <section className="mt-8">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-navy">Historique des quiz</h2>
                      <p className="mt-1 text-sm text-gray-600">Ouvre un quiz pour afficher ses détails dans une fenêtre dédiée.</p>
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
                          <button
                            type="button"
                            onClick={() => openDetail(h.quizId, h.official.resultToken)}
                            className="shrink-0 rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-navy/90"
                          >
                            Afficher les détails
                          </button>
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
      <ResultDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={closeDetail} />
    </>
  );
}
