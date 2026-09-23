"use client";

import { useEffect, useState } from "react";
import QuizSelect from "./QuizSelect";

interface Submission {
  id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  participant: { id: string; name: string; parish: string; email: string | null; whatsapp: string | null } | null;
}

export default function ResultsTab() {
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
      <h2 className="mb-4 text-lg font-bold text-navy">Résultats par quiz</h2>
      <div className="mb-4">
        <QuizSelect value={quizId} onChange={setQuizId} />
      </div>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : submissions.length === 0 ? (
        <p className="text-gray-500">Aucune soumission pour ce quiz.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Rang</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Paroisse</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Soumis le</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, index) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-semibold text-navy">{index + 1}</td>
                  <td className="py-3 pr-4 font-medium text-navy">
                    {s.participant?.name ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{s.participant?.parish ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-navy">
                      {s.score} / {s.max_score}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(s.submitted_at).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
