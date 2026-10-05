"use client";

import { useEffect, useState } from "react";

interface ActivityEntry {
  displayName: string;
  submittedAt: string;
}

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) {
    const s = Math.max(1, diffSec);
    return `il y a ${s} seconde${s > 1 ? "s" : ""}`;
  }
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `il y a ${min} minute${min > 1 ? "s" : ""}`;
  const hr = Math.floor(min / 60);
  return `il y a ${hr} heure${hr > 1 ? "s" : ""}`;
}

/**
 * Bandeau défilant : les participants (ayant opté dans le classement) qui
 * viennent de passer le quiz du jour, un par un, avec le temps écoulé.
 * Rafraîchi périodiquement pour intégrer les nouvelles soumissions sans
 * recharger la page.
 */
export default function LiveActivityTicker({
  quizId,
  quizTitle,
}: {
  quizId: string;
  quizTitle: string;
}) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch(`/api/quiz/${quizId}/activity-feed`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setEntries(data.entries ?? []);
        })
        .catch(() => {});
    }
    load();
    const poll = setInterval(load, 45000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [quizId]);

  // Fait avancer le bandeau d'une entrée à la fois.
  useEffect(() => {
    if (entries.length < 2) return;
    const rotate = setInterval(() => setIndex((i) => (i + 1) % entries.length), 4000);
    return () => clearInterval(rotate);
  }, [entries.length]);

  // Rafraîchit juste le texte "il y a X" affiché, sans changer d'entrée.
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(tick);
  }, []);

  if (entries.length === 0) return null;
  const current = entries[index % entries.length];

  return (
    <div className="mt-3 overflow-hidden rounded-lg bg-black/5 px-3 py-2 text-xs sm:text-sm">
      <p key={`${current.displayName}-${current.submittedAt}`} className="animate-ticker-in">
        🎉 <strong>{current.displayName}</strong> vient de passer le quiz « {quizTitle} » ·{" "}
        {formatRelativeTime(current.submittedAt)}
      </p>
    </div>
  );
}
