"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface LeaderboardEntry {
  displayName: string;
  score: number;
  maxScore: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ClassementPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;

  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/quiz/${quizId}/leaderboard`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Impossible de charger le classement.");
        }
        return res.json();
      })
      .then((data: { entries: LeaderboardEntry[] }) => setEntries(data.entries))
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }, [quizId]);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-navy">🏆 Classement</h1>
          <p className="mt-1 text-sm text-gray-500">
            Uniquement les participants ayant choisi d&apos;apparaître ici.
          </p>
        </div>

        {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}

        {!error && entries === null && (
          <p className="text-center text-gray-500">Chargement...</p>
        )}

        {entries && entries.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Personne n&apos;a encore choisi d&apos;apparaître dans ce classement.
          </p>
        )}

        {entries && entries.length > 0 && (
          <ol className="space-y-2">
            {entries.map((e, index) => (
              <li
                key={index}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  index < 3 ? "border-accent bg-accent/10" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-lg font-bold text-navy">
                    {MEDALS[index] ?? index + 1}
                  </span>
                  <p className="font-semibold text-navy">{e.displayName}</p>
                </div>
                <span className="font-bold text-navy">
                  {e.score} / {e.maxScore}
                </span>
              </li>
            ))}
          </ol>
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
