"use client";

import { useEffect, useMemo, useState } from "react";
import { generateResultsImage } from "@/lib/generate-results-image";

interface QuizOption {
  id: string;
  title: string;
  category: "daily" | "weekly" | "quarterly";
}

interface Competition {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  final_quiz_id: string;
  winner_count: number;
  final_quiz?: { id: string; title: string; category: string } | null;
}

interface RankingEntry {
  participantId: string;
  name: string;
  address: string | null;
  participationCount: number;
  publishedQuizCount: number;
  participationRate: number;
  eligible: boolean;
  rank: number | null;
  isWinner: boolean;
  officialPedagogicalScore: number;
  bestPedagogicalScore: number;
  pedagogicalMaxScore: number;
  examScore: number | null;
  combinedScore: number | null;
}

interface RankingResult {
  competition: Competition;
  finalQuiz: { id: string; title: string; category: string };
  publishedQuizCount: number;
  eligibleCount: number;
  ranking: RankingEntry[];
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00+01:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function QuarterlyRankingTab() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [title, setTitle] = useState("Classement trimestriel");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [finalQuizId, setFinalQuizId] = useState("");
  const [winnerCount, setWinnerCount] = useState("5");
  const [loading, setLoading] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sharingWinner, setSharingWinner] = useState<string | null>(null);

  const finalQuizzes = useMemo(() => quizzes.filter((quiz) => quiz.category === "quarterly"), [quizzes]);

  async function loadBaseData() {
    setLoading(true);
    setError("");
    try {
      const [competitionsRes, quizzesRes] = await Promise.all([
        fetch("/api/admin/quarterly", { cache: "no-store" }),
        fetch("/api/admin/quizzes", { cache: "no-store" }),
      ]);
      const competitionsData = await competitionsRes.json().catch(() => ({}));
      const quizzesData = await quizzesRes.json().catch(() => ({}));
      if (!competitionsRes.ok) throw new Error(competitionsData.error || "Erreur de chargement.");
      if (!quizzesRes.ok) throw new Error(quizzesData.error || "Erreur de chargement des quiz.");
      const nextCompetitions: Competition[] = competitionsData.competitions ?? [];
      setCompetitions(nextCompetitions);
      setQuizzes(quizzesData.quizzes ?? []);
      if (!selectedId && nextCompetitions[0]) setSelectedId(nextCompetitions[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBaseData();
    // Le chargement initial ne doit pas dépendre des changements de sélection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRanking(id: string) {
    if (!id) return;
    setSelectedId(id);
    setLoadingRanking(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/quarterly/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Impossible de calculer le classement.");
      setRanking(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoadingRanking(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/quarterly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          title,
          periodStart,
          periodEnd,
          finalQuizId,
          winnerCount: Number(winnerCount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Impossible d’enregistrer la compétition.");
      setSuccess("Compétition trimestrielle enregistrée.");
      await loadBaseData();
      if (data.competition?.id) await loadRanking(data.competition.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    if (!ranking) return;
    const header = ["Rang", "Nom", "Participation", "Score pédagogique officiel", "Meilleure note pédagogique", "Examen", "Score final", "Éligible", "Gagnant"];
    const rows = ranking.ranking.map((entry) => [
      entry.rank ?? "—",
      entry.name,
      `${entry.participationCount}/${entry.publishedQuizCount} (${entry.participationRate}%)`,
      `${entry.officialPedagogicalScore}/${entry.pedagogicalMaxScore}`,
      entry.bestPedagogicalScore,
      entry.examScore ?? "—",
      entry.combinedScore ?? "—",
      entry.eligible ? "Oui" : "Non",
      entry.isWinner ? "Oui" : "Non",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "classement-trimestriel.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function shareWinnerVisual(entry: RankingEntry) {
    if (!ranking || !entry.isWinner) return;
    setSharingWinner(entry.participantId);
    setError("");
    try {
      const brand = await fetch("/api/site-brand", { cache: "no-store" }).then((response) => response.json());
      const pedagogicalAverage = ranking.publishedQuizCount
        ? Math.round((entry.officialPedagogicalScore / ranking.publishedQuizCount) * 100) / 100
        : 0;
      const blob = await generateResultsImage({
        participantName: entry.name,
        score: entry.examScore ?? 0,
        maxScore: 20,
        quizTitle: ranking.finalQuiz.title,
        siteName: brand.siteName || "Quiz Biblique MEF",
        visual: {
          mode: "quarterly",
          config: brand.resultShareQuarterlyConfig,
          quarterLabel: ranking.competition.title,
          rank: entry.rank,
          rankLabel: entry.rank === 1 ? "1er prix" : `${entry.rank ?? ""}e prix`,
          examScore: entry.examScore,
          pedagogicalAverage,
          finalScore: entry.combinedScore,
          prize: "",
        },
      });
      const file = new File([blob], "gagnant-concours-trimestriel.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Gagnant du concours trimestriel" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "gagnant-concours-trimestriel.png";
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setError(error instanceof Error ? error.message : "Impossible de générer le visuel.");
      }
    } finally {
      setSharingWinner(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="mb-2 text-lg font-bold text-navy">Classement et gagnants trimestriels</h2>
        <p className="mb-5 text-sm leading-relaxed text-gray-600">
          Le score pédagogique sert à apprendre et peut afficher la meilleure note. Le classement
          officiel retient uniquement la première tentative valide de chaque quiz. Une annulation
          technique est neutre. Pour être éligible, il faut au moins 80 % de participation aux
          quiz du jour et hebdomadaires, ainsi qu’une tentative valide à l’examen final.
        </p>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field" htmlFor="competition-title">Nom de la compétition</label>
            <input id="competition-title" className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Trimestre septembre-novembre 2026" required />
          </div>
          <div>
            <label className="label-field" htmlFor="period-start">Début de la période</label>
            <input id="period-start" type="date" className="input-field" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
          </div>
          <div>
            <label className="label-field" htmlFor="period-end">Fin de la période</label>
            <input id="period-end" type="date" className="input-field" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
          </div>
          <div>
            <label className="label-field" htmlFor="final-quiz">Examen trimestriel final</label>
            <select id="final-quiz" className="input-field" value={finalQuizId} onChange={(e) => setFinalQuizId(e.target.value)} required>
              <option value="">Choisir l’examen final...</option>
              {finalQuizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
            </select>
            {finalQuizzes.length === 0 && <p className="mt-1 text-xs text-amber-700">Crée d’abord un quiz de catégorie « trimestriel ».</p>}
          </div>
          <div>
            <label className="label-field" htmlFor="winner-count">Nombre de gagnants à primer</label>
            <input id="winner-count" type="number" min={1} max={100} className="input-field" value={winnerCount} onChange={(e) => setWinnerCount(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving || loading}>{saving ? "Enregistrement..." : "Enregistrer et calculer le classement"}</button>
          </div>
        </form>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {success && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">{success}</p>}

      <section className="card">
        <h3 className="mb-3 text-base font-bold text-navy">Compétitions enregistrées</h3>
        {loading ? <p className="text-gray-500">Chargement...</p> : competitions.length === 0 ? <p className="text-gray-500">Aucune compétition trimestrielle enregistrée.</p> : (
          <div className="space-y-2">
            {competitions.map((competition) => (
              <button key={competition.id} type="button" onClick={() => loadRanking(competition.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${selectedId === competition.id ? "border-accent bg-accent/5" : "border-gray-200 hover:border-accent"}`}>
                <span><strong className="text-navy">{competition.title}</strong><span className="mt-1 block text-xs text-gray-500">{formatDate(competition.period_start)} → {formatDate(competition.period_end)} · {competition.winner_count} gagnant(s)</span></span>
                <span className="text-sm font-semibold text-accent-dark">Voir →</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {loadingRanking && <section className="card"><p className="text-gray-500">Calcul du classement...</p></section>}
      {ranking && !loadingRanking && (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-navy">{ranking.competition.title}</h3>
              <p className="mt-1 text-sm text-gray-500">Examen : {ranking.finalQuiz.title} · {ranking.publishedQuizCount} quiz pédagogiques publiés · {ranking.eligibleCount} participant(s) éligible(s)</p>
            </div>
            <button type="button" onClick={exportCsv} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-navy hover:bg-gray-50">Exporter CSV</button>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-purple-50 p-4"><p className="text-xs font-semibold uppercase text-purple-700">Gagnants</p><p className="mt-1 text-2xl font-bold text-purple-900">{ranking.ranking.filter((e) => e.isWinner).length}</p></div>
            <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold uppercase text-blue-700">Seuil</p><p className="mt-1 text-2xl font-bold text-blue-900">80 %</p></div>
            <div className="rounded-xl bg-green-50 p-4"><p className="text-xs font-semibold uppercase text-green-700">Examen</p><p className="mt-1 text-2xl font-bold text-green-900">/ 20</p></div>
          </div>
          {ranking.ranking.length === 0 ? <p className="text-gray-500">Aucun participant n’a encore de résultat sur cette période.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><th className="py-2 pr-3">Rang</th><th className="py-2 pr-3">Participant</th><th className="py-2 pr-3">Participation</th><th className="py-2 pr-3">Pédagogique officiel</th><th className="py-2 pr-3">Meilleure note pédagogique</th><th className="py-2 pr-3">Examen</th><th className="py-2 pr-3">Total officiel</th><th className="py-2 pr-3">Statut</th><th className="py-2">Visuel</th></tr></thead><tbody>{ranking.ranking.map((entry) => <tr key={entry.participantId} className={`border-b border-gray-100 ${entry.isWinner ? "bg-yellow-50" : ""}`}><td className="py-3 pr-3 text-lg font-bold text-navy">{entry.rank ? (entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`) : "—"}</td><td className="py-3 pr-3"><p className="font-semibold text-navy">{entry.name}</p><p className="text-xs text-gray-500">{entry.address || "—"}</p></td><td className="py-3 pr-3"><strong>{entry.participationRate} %</strong><span className="block text-xs text-gray-500">{entry.participationCount}/{entry.publishedQuizCount}</span></td><td className="py-3 pr-3">{entry.officialPedagogicalScore} / {entry.pedagogicalMaxScore}</td><td className="py-3 pr-3">{entry.bestPedagogicalScore} / {entry.pedagogicalMaxScore}</td><td className="py-3 pr-3">{entry.examScore === null ? "—" : `${entry.examScore} / 20`}</td><td className="py-3 pr-3 font-bold text-navy">{entry.combinedScore === null ? "—" : entry.combinedScore}</td><td className="py-3 pr-3">{entry.isWinner ? <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-800">À primer</span> : entry.eligible ? <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Éligible</span> : <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">Non éligible</span>}</td><td className="py-3">{entry.isWinner && <button type="button" onClick={() => shareWinnerVisual(entry)} disabled={sharingWinner === entry.participantId} className="rounded-lg border border-navy px-2 py-1 text-xs font-semibold text-navy hover:bg-blue-50 disabled:opacity-50">{sharingWinner === entry.participantId ? "Préparation..." : "Créer le visuel"}</button>}</td></tr>)}</tbody></table></div>
          )}
        </section>
      )}
    </div>
  );
}
