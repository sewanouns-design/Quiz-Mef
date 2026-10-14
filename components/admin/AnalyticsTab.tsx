"use client";

import { useEffect, useState } from "react";

type CountRow = { key: string; count: number };
type TimeRow = { key: string; views: number; sessions: number };
type JourneyRow = { key: string; count: number; pages: number };
type AnalyticsFilter = { dimension: string; key: string };

interface AnalyticsData {
  metrics?: {
    pageViews?: number;
    uniqueVisitors?: number;
    sessions?: number;
    averagePagesPerSession?: number;
    bounceRate?: number;
    clicks?: number;
    returningVisitors?: number;
  };
  countries?: CountRow[];
  pages?: CountRow[];
  devices?: CountRow[];
  browsers?: CountRow[];
  operatingSystems?: CountRow[];
  referrers?: CountRow[];
  timeseries?: TimeRow[];
  journeys?: JourneyRow[];
  clicks?: CountRow[];
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateString(date);
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat("fr-FR").format(value ?? 0);
}

function Kpi({ icon, label, value, detail }: { icon: string; label: string; value: string; detail?: string }) {
  return (
    <div className="card !p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
          {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-xl">{icon}</span>
      </div>
    </div>
  );
}

function ListCard({
  title,
  icon,
  rows,
  dimension,
  active,
  onSelect,
  empty = "Aucune donnée sur cette période.",
}: {
  title: string;
  icon: string;
  rows: CountRow[];
  dimension: string;
  active: AnalyticsFilter | null;
  onSelect: (dimension: string, key: string) => void;
  empty?: string;
}) {
  const visibleRows = active?.dimension === dimension ? rows.filter((row) => row.key === active.key) : rows;
  const max = Math.max(...visibleRows.map((row) => row.count), 1);
  return (
    <section className="card !p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h3 className="flex items-center gap-2 font-bold text-navy"><span>{icon}</span>{title}</h3>
        <span className="text-xs text-gray-400">Cliquer pour isoler</span>
      </div>
      {visibleRows.length === 0 ? (
        <p className="p-5 text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {visibleRows.slice(0, 10).map((row) => (
            <button
              type="button"
              key={row.key}
              onClick={() => onSelect(dimension, row.key)}
              className={`w-full px-5 py-3 text-left transition-colors hover:bg-accent/5 ${active?.dimension === dimension && active.key === row.key ? "bg-accent/10" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-gray-700">{row.key}</span>
                <span className="shrink-0 font-bold text-navy">{formatNumber(row.count)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AnalyticsTab() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(dateString(new Date()));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<AnalyticsFilter | null>(null);

  useEffect(() => {
    if (!from || !to || from > to) return;
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    fetch(`/api/admin/analytics?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Impossible de charger les Analytics.");
        setData(payload.analytics ?? {});
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, [from, to]);

  const metrics = data?.metrics ?? {};
  const timeseries = data?.timeseries ?? [];
  const maxViews = Math.max(...timeseries.map((row) => row.views), 1);
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-600">{error}</p>
        {error.includes("autorisé") && <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">Se reconnecter →</a>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy">Analytics du site</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Visites publiques, appareils, pays, pages consultées et parcours anonymisés. Les pages d’administration sont exclues.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Du<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-gray-200 px-2 py-2 text-sm text-navy" /></label>
          <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Au<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-gray-200 px-2 py-2 text-sm text-navy" /></label>
        </div>
      </div>

      {activeFilter && (
        <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
          <span className="text-accent-dark">Focus actif ({activeFilter.dimension}) : <strong>{activeFilter.key}</strong></span>
          <button type="button" onClick={() => setActiveFilter(null)} className="font-semibold text-accent-dark hover:underline">Réinitialiser</button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card h-28 animate-pulse bg-gray-100" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon="👁️" label="Pages vues" value={formatNumber(metrics.pageViews)} detail="consultations publiques" />
            <Kpi icon="👥" label="Visiteurs uniques" value={formatNumber(metrics.uniqueVisitors)} detail={`${formatNumber(metrics.returningVisitors)} visiteurs revenus`} />
            <Kpi icon="🧭" label="Sessions" value={formatNumber(metrics.sessions)} detail={`${formatNumber(metrics.averagePagesPerSession)} pages / session`} />
            <Kpi icon="↩️" label="Taux de rebond" value={`${metrics.bounceRate ?? 0}%`} detail={`${formatNumber(metrics.clicks)} interactions`} />
          </div>

          <section className="card !p-0 overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-bold text-navy">📈 Évolution des visites</h3></div>
            {timeseries.length === 0 ? <p className="p-5 text-sm text-gray-400">Aucune visite enregistrée sur cette période.</p> : (
              <div className="flex items-end gap-1 overflow-x-auto px-5 pb-5 pt-6" style={{ minHeight: 190 }}>
                {timeseries.map((row) => (
                  <div key={row.key} className="group flex min-w-[24px] flex-1 flex-col items-center gap-2" title={`${row.key} : ${row.views} pages vues`}>
                    <div className="flex h-32 w-full items-end justify-center"><div className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-accent to-accent-light transition-opacity group-hover:opacity-70" style={{ height: `${Math.max((row.views / maxViews) * 100, 3)}%` }} /></div>
                    <span className="text-[9px] text-gray-400">{row.key.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <ListCard title="Pays des visiteurs" dimension="pays" icon="🌍" rows={data?.countries ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
            <ListCard title="Pages les plus consultées" dimension="pages" icon="📄" rows={data?.pages ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
            <ListCard title="Type d’appareil" dimension="appareils" icon="📱" rows={data?.devices ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
            <ListCard title="Navigateurs" dimension="navigateurs" icon="🌐" rows={data?.browsers ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
            <ListCard title="Systèmes d’exploitation" dimension="systèmes" icon="💻" rows={data?.operatingSystems ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
            <ListCard title="Origines des visites" dimension="origines" icon="🔗" rows={data?.referrers ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ListCard title="Interactions les plus fréquentes" dimension="interactions" icon="🖱️" rows={data?.clicks ?? []} active={activeFilter} onSelect={(dimension, key) => setActiveFilter({ dimension, key })} />
            <section className="card !p-0 overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-bold text-navy">🧭 Parcours les plus fréquents</h3></div>
              {(data?.journeys ?? []).length === 0 ? <p className="p-5 text-sm text-gray-400">Les parcours apparaîtront après les premières visites.</p> : (
                <div className="divide-y divide-gray-100">
                  {(data?.journeys ?? []).slice(0, 8).map((journey) => (
                    <div key={journey.key} className="flex items-start justify-between gap-4 px-5 py-3">
                      <p className="break-all text-sm leading-5 text-gray-600">{journey.key}</p>
                      <span className="shrink-0 rounded-full bg-navy/8 px-2 py-1 text-xs font-bold text-navy">{journey.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
