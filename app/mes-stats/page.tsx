"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateDeviceKey } from "@/lib/participant-storage";

interface StatsData {
  participant: { name: string } | null;
  quizzesCount?: number;
  passedCount?: number;
  averagePercent?: number | null;
  bestScorePercent?: number | null;
  streakDays?: number;
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
            <StatCard icon="📝" value={data.quizzesCount ?? 0} label="Quiz passés" />
            <StatCard icon="✅" value={data.passedCount ?? 0} label="Réussis" />
            <StatCard
              icon="📊"
              value={data.averagePercent !== null && data.averagePercent !== undefined ? `${data.averagePercent}%` : "—"}
              label="Score moyen"
            />
            <StatCard
              icon="🏆"
              value={
                data.bestScorePercent !== null && data.bestScorePercent !== undefined
                  ? `${data.bestScorePercent}%`
                  : "—"
              }
              label="Meilleur score"
            />
            {(data.streakDays ?? 0) >= 2 && (
              <div className="col-span-2">
                <StatCard icon="🔥" value={`${data.streakDays} jours`} label="Série en cours" />
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/" className="btn-secondary">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
