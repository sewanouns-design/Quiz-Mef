"use client";

import { useEffect, useState } from "react";
import QuizSelect from "./QuizSelect";

interface ParishGroup {
  parish: string;
  average: number;
  count: number;
  participants: { name: string; score: number; maxScore: number }[];
}

export default function ParishLeaderboardTab() {
  const [quizId, setQuizId] = useState("");
  const [parishes, setParishes] = useState<ParishGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    fetch(`/api/admin/leaderboard/${quizId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setParishes(data.parishes ?? []))
      .finally(() => setLoading(false));
  }, [quizId]);

  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-bold text-navy">Classement par paroisse</h2>
      <div className="mb-4">
        <QuizSelect value={quizId} onChange={setQuizId} />
      </div>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : parishes.length === 0 ? (
        <p className="text-gray-500">Aucune soumission pour ce quiz.</p>
      ) : (
        <div className="space-y-4">
          {parishes.map((group, index) => (
            <div key={group.parish} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy">
                    {index + 1}. {group.parish}
                  </p>
                  <p className="text-xs text-gray-500">{group.count} participant(s)</p>
                </div>
                <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-bold text-navy">
                  Moyenne : {group.average.toFixed(1)}
                </span>
              </div>
              <ul className="space-y-1">
                {group.participants.map((p, i) => (
                  <li
                    key={`${p.name}-${i}`}
                    className="flex items-center justify-between text-sm text-gray-700"
                  >
                    <span>{p.name}</span>
                    <span className="font-semibold text-navy">
                      {p.score} / {p.maxScore}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
