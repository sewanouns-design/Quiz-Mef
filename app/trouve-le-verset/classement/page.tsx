"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getStoredParticipant } from "@/lib/participant-storage";

interface LeaderboardEntry {
  displayName: string;
  score: number;
  level: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function VerseGameClassementPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const deviceKey = getStoredParticipant()?.deviceKey ?? "";
    fetch(`/api/verse-game/leaderboard?deviceKey=${encodeURIComponent(deviceKey)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Impossible de charger le classement.");
        }
        return res.json();
      })
      .then((data: { entries: LeaderboardEntry[]; totalPlayers: number; myRank: number | null }) => {
        setEntries(data.entries);
        setTotalPlayers(data.totalPlayers ?? 0);
        setMyRank(data.myRank);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."));
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-navy">🏆 Classement — Trouve le verset</h1>
            <p className="mt-1 text-sm text-gray-500">
              {totalPlayers > 0
                ? `${totalPlayers} joueur${totalPlayers > 1 ? "s" : ""} au total.`
                : "Points cumulés sur tous les niveaux."}
              {myRank && <> Tu es #{myRank}.</>}
            </p>
          </div>

          {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}

          {!error && entries === null && <p className="text-center text-gray-500">Chargement...</p>}

          {entries && entries.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Personne n&apos;a encore joué. Sois le premier !
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
                    <div>
                      <p className="font-semibold text-navy">{e.displayName}</p>
                      <p className="text-xs text-gray-400">Niveau {e.level}</p>
                    </div>
                  </div>
                  <span className="font-bold text-navy">🏅 {e.score}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/trouve-le-verset" className="btn-accent">
              📖 Jouer
            </Link>
            <Link href="/" className="btn-secondary">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
