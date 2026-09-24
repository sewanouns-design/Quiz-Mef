"use client";

import { useEffect, useState } from "react";

interface OverviewData {
  participantsCount: number;
  quizzesCount: number;
  submissionsCount: number;
  cancelledCount: number;
  passedCount: number;
  averageScorePercent: number | null;
  lessonQuestionsCount: number;
  parishesCount: number;
  activeQuizTitle: string | null;
  recentSubmissions: {
    score: number;
    max_score: number;
    cancelled: boolean;
    submitted_at: string;
    participant: { name: string; parish: string } | null;
    quiz: { title: string } | null;
  }[];
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-extrabold text-navy">{value}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi.");
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || "Erreur lors du chargement de la vue d'ensemble.");
        }
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-600">{error || "Erreur inconnue."}</p>
        {error?.includes("Session expirée") && (
          <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
            Se reconnecter →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card bg-navy text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Quiz actif aujourd&apos;hui
        </p>
        <p className="mt-1 text-xl font-bold">
          {data.activeQuizTitle ?? "Aucun quiz actif pour le moment"}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon="👥" value={data.participantsCount} label="Participants" />
        <StatCard icon="📚" value={data.quizzesCount} label="Quiz créés" />
        <StatCard icon="📝" value={data.submissionsCount} label="Soumissions" />
        <StatCard icon="✅" value={data.passedCount} label="Réussites (≥ 60%)" />
        <StatCard
          icon="📊"
          value={data.averageScorePercent !== null ? `${data.averageScorePercent}%` : "—"}
          label="Score moyen"
        />
        <StatCard icon="⛪" value={data.parishesCount} label="Paroisses représentées" />
        <StatCard icon="💬" value={data.lessonQuestionsCount} label="Questions sur la leçon" />
        <StatCard icon="⚠️" value={data.cancelledCount} label="Tests annulés" />
      </div>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold text-navy">Activité récente</h2>
        {data.recentSubmissions.length === 0 ? (
          <p className="text-gray-500">Aucune soumission pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {data.recentSubmissions.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-navy">
                    {s.participant?.name ?? "—"}{" "}
                    <span className="font-normal text-gray-400">· {s.participant?.parish}</span>
                  </p>
                  <p className="text-xs text-gray-500">{s.quiz?.title ?? "Quiz supprimé"}</p>
                </div>
                <div className="text-right">
                  {s.cancelled ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                      Annulé
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-navy">
                      {s.score} / {s.max_score}
                    </span>
                  )}
                  <p className="mt-1 text-[10px] text-gray-400">
                    {new Date(s.submitted_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
