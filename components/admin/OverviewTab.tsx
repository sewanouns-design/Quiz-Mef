"use client";

import { useEffect, useMemo, useState } from "react";

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

type PeriodPreset = "today" | "7d" | "30d" | "month" | "all" | "custom";

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "month", label: "Ce mois-ci" },
  { id: "all", label: "Tout" },
  { id: "custom", label: "Personnalisé" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string
): { from: string | null; to: string | null } {
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") return { from: customFrom || null, to: customTo || null };

  const now = new Date();
  const to = toIsoDate(now);
  let from: Date;
  if (preset === "today") {
    from = now;
  } else if (preset === "7d") {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
  } else if (preset === "30d") {
    from = new Date(now);
    from.setDate(from.getDate() - 29);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: toIsoDate(from), to };
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function StatCard({
  icon,
  value,
  label,
  tone = "navy",
}: {
  icon: string;
  value: string | number;
  label: string;
  tone?: "navy" | "accent";
}) {
  return (
    <div className="card !p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
            tone === "accent" ? "bg-accent/10 text-accent-dark" : "bg-navy/8 text-navy"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold leading-tight text-navy">{value}</p>
          <p className="text-xs font-medium uppercase leading-tight tracking-wide text-gray-500">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => computeRange(preset, customFrom, customTo), [
    preset,
    customFrom,
    customTo,
  ]);

  useEffect(() => {
    if (preset === "custom" && (!range.from || !range.to)) return;

    setLoading(true);
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);

    fetch(`/api/admin/overview?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi.");
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || "Erreur lors du chargement de la vue d'ensemble.");
        }
        setData(json);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, [range.from, range.to, preset]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-600">{error}</p>
        {error.includes("Session expirée") && (
          <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
            Se reconnecter →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy">Vue d&apos;ensemble</h2>
          <p className="text-sm text-gray-500">Statistiques globales de la plateforme.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-gray-100 p-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                preset === p.id
                  ? "bg-navy text-white shadow-sm"
                  : "text-gray-600 hover:bg-white hover:text-navy"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div>
            <label className="label-field" htmlFor="overview-from">
              Du
            </label>
            <input
              id="overview-from"
              type="date"
              className="input-field"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field" htmlFor="overview-to">
              Au
            </label>
            <input
              id="overview-to"
              type="date"
              className="input-field"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          {(!customFrom || !customTo) && (
            <p className="pb-3 text-xs text-gray-400">Choisis une date de début et de fin.</p>
          )}
        </div>
      )}

      {loading || !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card !p-5 h-[76px] animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          <section className="card overflow-hidden !p-0">
            <div className="bg-gradient-to-br from-navy to-navy-dark px-6 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Quiz actif aujourd&apos;hui
              </p>
              <p className="mt-1 text-xl font-bold">
                {data.activeQuizTitle ?? "Aucun quiz actif pour le moment"}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard icon="👥" value={data.participantsCount} label="Participants" />
            <StatCard icon="📚" value={data.quizzesCount} label="Quiz créés" />
            <StatCard icon="📝" value={data.submissionsCount} label="Soumissions" />
            <StatCard
              icon="✅"
              value={data.passedCount}
              label="Réussites (≥ 60%)"
              tone="accent"
            />
            <StatCard
              icon="📊"
              value={data.averageScorePercent !== null ? `${data.averageScorePercent}%` : "—"}
              label="Score moyen"
            />
            <StatCard icon="⛪" value={data.parishesCount} label="Paroisses représentées" />
            <StatCard icon="💬" value={data.lessonQuestionsCount} label="Questions sur la leçon" />
            <StatCard
              icon="⚠️"
              value={data.cancelledCount}
              label="Tests annulés"
              tone="accent"
            />
          </div>

          <section className="card">
            <h2 className="mb-4 text-lg font-bold text-navy">Activité récente</h2>
            {data.recentSubmissions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
                Aucune soumission sur cette période.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.recentSubmissions.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
                        {initials(s.participant?.name ?? "?")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy">
                          {s.participant?.name ?? "—"}{" "}
                          <span className="font-normal text-gray-400">
                            · {s.participant?.parish}
                          </span>
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {s.quiz?.title ?? "Quiz supprimé"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {s.cancelled ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Annulé
                        </span>
                      ) : (
                        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-dark">
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
        </>
      )}
    </div>
  );
}
