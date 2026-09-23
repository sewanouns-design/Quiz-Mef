"use client";

import { useEffect, useState } from "react";
import QuizSelect from "./QuizSelect";
import ParticipantDetailModal from "./ParticipantDetailModal";

interface Submission {
  id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  participant: { id: string; name: string; parish: string; email: string | null; whatsapp: string | null } | null;
}

function toWhatsappLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

export default function ResultsTab() {
  const [quizId, setQuizId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/results/${quizId}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les résultats.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des résultats.");
        }
        setSubmissions(data.submissions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">Rang</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Paroisse</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">WhatsApp</th>
                <th className="py-2 pr-4">Soumis le</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, index) => (
                <tr key={s.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-semibold text-navy">{index + 1}</td>
                  <td className="py-3 pr-4 font-medium text-navy">
                    {s.participant ? (
                      <button
                        type="button"
                        onClick={() => setSelectedParticipantId(s.participant!.id)}
                        className="hover:underline"
                      >
                        {s.participant.name}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{s.participant?.parish ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-navy">
                      {s.score} / {s.max_score}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {s.participant?.email ? (
                      <a
                        href={`mailto:${s.participant.email}`}
                        className="text-accent-dark hover:underline"
                      >
                        {s.participant.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {s.participant?.whatsapp ? (
                      <a
                        href={toWhatsappLink(s.participant.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        {s.participant.whatsapp}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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

      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          onClose={() => setSelectedParticipantId(null)}
        />
      )}
    </section>
  );
}
