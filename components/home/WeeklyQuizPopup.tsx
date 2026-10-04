"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredParticipant } from "@/lib/participant-storage";

interface Props {
  weeklyQuiz: { id: string; title: string; subtitle: string | null } | null;
}

/**
 * Pop-up pour le quiz hebdomadaire (récap de la semaine), visible UNIQUEMENT
 * sur la page d'accueil — le quiz hebdo n'apparaît jamais dans le flux
 * normal d'identification/sélection de quiz (voir app/quiz/page.tsx), seul
 * ce lien direct (?quiz=<id>) y donne accès.
 *
 * Comme la bannière d'installation PWA : AUCUNE mémorisation de fermeture.
 * Fermer le pop-up ne le cache que pour la visite en cours, il revient à
 * chaque nouvelle connexion tant que la personne n'a pas encore fait ce
 * quiz précis (vérifié via alreadySubmitted, qui tient compte des essais
 * déjà passés) — seul le fait de l'avoir réellement complété l'arrête.
 */
export default function WeeklyQuizPopup({ weeklyQuiz }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!weeklyQuiz) return;

    const stored = getStoredParticipant();
    if (!stored?.deviceKey) {
      // Jamais identifié sur cet appareil : certainement pas encore fait.
      setVisible(true);
      return;
    }

    fetch(`/api/quiz/${weeklyQuiz.id}?deviceKey=${encodeURIComponent(stored.deviceKey)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.alreadySubmitted) setVisible(true);
      })
      .catch(() => setVisible(true));
  }, [weeklyQuiz]);

  if (!weeklyQuiz || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={() => setVisible(false)}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          ✕
        </button>
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-3xl">
          📅
        </span>
        <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
          Quiz hebdomadaire disponible
        </p>
        <p className="mt-1 text-lg font-bold text-navy">{weeklyQuiz.title}</p>
        <p className="mt-2 text-sm text-gray-500">
          {weeklyQuiz.subtitle || "Récapitule tout ce qu'on a vu cette semaine."}
        </p>
        <Link
          href={`/quiz?quiz=${weeklyQuiz.id}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        >
          Commencer le quiz hebdo
        </Link>
      </div>
    </div>
  );
}
