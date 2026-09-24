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
  activeQuizTitle: string | null;
  recentSubmissions: {
    score: number;
    max_score: number;
    cancelled: boolean;
    submitted_at: string;
    participant: { name: string; address: string } | null;
    quiz: { title: string } | null;
  }[];
}

type PeriodPreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "all"
  | "custom";

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "yesterday", label: "Hier" },
  { id: "thisWeek", label: "Cette semaine" },
  { id: "lastWeek", label: "Semaine dernière" },
  { id: "thisMonth", label: "Ce mois-ci" },
  { id: "lastMonth", label: "Mois dernier" },
  { id: "all", label: "Tout" },
  { id: "custom", label: "Personnalisé" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant `d` (semaine ISO, lundi = premier jour). */
function startOfWeek(d: Date): Date {
  const result = new Date(d);
  const isoDay = (d.getDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
  result.setDate(result.getDate() - isoDay);
  return result;
}

function computeRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string
): { from: string | null; to: string | null } {
  if (preset === "all") return { from: null, to: null };
  if (preset === "custom") return { from: customFrom || null, to: customTo || null };

  const now = new Date();

  if (preset === "today") {
    return { from: toIsoDate(now), to: toIsoDate(now) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: toIsoDate(y), to: toIsoDate(y) };
  }
  if (preset === "thisWeek") {
    return { from: toIsoDate(startOfWeek(now)), to: toIsoDate(now) };
  }
  if (preset === "lastWeek") {
    const thisMonday = startOfWeek(now);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(lastSunday.getDate() - 1);
    return { from: toIsoDate(lastMonday), to: toIsoDate(lastSunday) };
  }
  if (preset === "thisMonth") {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIsoDate(now) };
  }
  // lastMonth
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toIsoDate(lastMonthStart), to: toIsoDate(lastMonthEnd) };
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

function PeriodDropdown({
  preset,
  setPreset,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}: {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = PRESETS.find((p) => p.id === preset)?.label ?? "Période";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy shadow-sm transition-colors hover:border-navy/30"
      >
        <span aria-hidden="true">📅</span>
        {currentLabel}
        <span className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
            <ul className="py-1.5">
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreset(p.id);
                      if (p.id !== "custom") setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                      preset === p.id ? "bg-navy/5 text-navy" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                    {preset === p.id && <span className="text-navy">✓</span>}
                  </button>
                </li>
              ))}
            </ul>

            {preset === "custom" && (
              <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                      Début
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                      Fin
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!customFrom || !customTo}
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-navy py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Appliquer
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<PeriodPreset>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);

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
        <PeriodDropdown
          preset={preset}
          setPreset={setPreset}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
        />
      </div>

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
            <StatCard icon="💬" value={data.lessonQuestionsCount} label="Questions sur la leçon" />
            <StatCard
              icon="⚠️"
              value={data.cancelledCount}
              label="Tests annulés"
              tone="accent"
            />
          </div>

          <section className="card !p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setActivityOpen((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-lg font-bold text-navy">
                Activité récente
                {data.recentSubmissions.length > 0 && (
                  <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                    {data.recentSubmissions.length}
                  </span>
                )}
              </span>
              <span
                className={`text-gray-400 transition-transform ${activityOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                ⌄
              </span>
            </button>

            {activityOpen && (
              <div className="border-t border-gray-100 px-6 pb-5 pt-1">
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
                                · {s.participant?.address}
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
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
