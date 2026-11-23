"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredParticipant } from "@/lib/participant-storage";

interface TesteurQuiz {
  id: string;
  done: boolean;
}

/**
 * Affichée uniquement pour un compte testeur (is_test=true) sur la page de
 * résultat d'un quiz : propose directement le prochain quiz non fait, pour
 * enchaîner tout le trimestre sans repasser par /testeur à chaque fois.
 */
export default function TesteurNextQuizButton({ currentQuizId }: { currentQuizId: string }) {
  const [nextQuizId, setNextQuizId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) return;
    fetch(`/api/testeur/quizzes?deviceKey=${encodeURIComponent(deviceKey)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const quizzes: TesteurQuiz[] = data?.quizzes ?? [];
        if (quizzes.length === 0) return;
        const next = quizzes.find((q) => q.id !== currentQuizId && !q.done);
        setNextQuizId(next ? next.id : null);
      })
      .catch(() => {});
  }, [currentQuizId]);

  if (nextQuizId === undefined) return null;

  return (
    <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-4 text-center">
      <p className="mb-3 text-sm font-semibold text-amber-800">🧪 Mode testeur</p>
      {nextQuizId ? (
        <Link href={`/quiz/${nextQuizId}`} className="btn-accent inline-block w-full">
          Quiz testeur suivant →
        </Link>
      ) : (
        <p className="text-sm font-medium text-amber-800">
          ✅ Tu as fait tous les quiz disponibles pour le test.
        </p>
      )}
    </div>
  );
}
