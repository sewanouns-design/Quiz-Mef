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
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/results/${quizId}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir le classement.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement du classement.");
        }
        setSubmissions(data.submissions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
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
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-600">{error}</p>
          {error.includes("Session expirée") && (
            <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
              Se reconnecter →
            </a>
          )}
        </div>
      ) : submissions.length === 0 ? (
        <p className="text-gray-500">Aucune soumission pour ce quiz.</p>
      ) : (
        <ol className="space-y-2">
          {submissions.map((s, index) => (
            <li
              key={s.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                index < 3 ? "border-accent bg-accent/10" : "border-gray-200"
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
