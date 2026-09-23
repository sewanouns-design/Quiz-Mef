"use client";

import { useEffect, useState } from "react";
import QuizSelect from "./QuizSelect";

interface Submission {
  id: string;
  score: number;
  max_score: number;
  participant: { id: string; name: string; parish: string } | null;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardTab() {
  const [quizId, setQuizId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    fetch(`/api/admin/results/${quizId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSubmissions(data.submissions ?? []))
      .finally(() => setLoading(false));
  }, [quizId]);

  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-bold text-navy">Classement général</h2>
      <div className="mb-4">
        <QuizSelect value={quizId} onChange={setQuizId} />
      </div>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : submissions.length === 0 ? (
        <p className="text-gray-500">Aucune soumission pour ce quiz.</p>
      ) : (
        <ol className="space-y-2">
          {submissions.map((s, index) => (
            <li
              key={s.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                index < 3 ? "border-gold bg-gold/10" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold text-navy">
                  {MEDALS[index] ?? index + 1}
                </span>
                <div>
                  <p className="font-semibold text-navy">{s.participant?.name ?? "—"}</p>
                  <p className="text-xs text-gray-500">{s.participant?.parish ?? "—"}</p>
                </div>
              </div>
              <span className="font-bold text-navy">
                {s.score} / {s.max_score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
