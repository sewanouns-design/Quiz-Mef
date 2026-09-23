"use client";

import { useEffect, useState } from "react";
import ParticipantDetailModal from "./ParticipantDetailModal";

interface LessonQuestionEntry {
  id: string;
  question_text: string;
  created_at: string;
  participant: { id: string; name: string; parish: string } | null;
  quiz: { id: string; title: string; lesson_date: string } | null;
}

export default function QuestionsTab() {
  const [questions, setQuestions] = useState<LessonQuestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/lesson-questions", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des questions.");
        }
        setQuestions(data.questions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-bold text-navy">
        Questions sur la leçon <span className="text-gray-400">({questions.length})</span>
      </h2>

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
      ) : questions.length === 0 ? (
        <p className="text-gray-500">Aucune question posée pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                {q.participant ? (
                  <button
                    type="button"
                    onClick={() => setSelectedParticipantId(q.participant!.id)}
                    className="font-semibold text-navy hover:underline"
                  >
                    {q.participant.name}
                  </button>
                ) : (
                  <span className="font-semibold text-navy">Participant inconnu</span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(q.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
              {q.quiz && (
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-accent-dark">
                  {q.quiz.title} · {new Date(q.quiz.lesson_date).toLocaleDateString("fr-FR")}
                </p>
              )}
              <p className="text-sm text-gray-700">{q.question_text}</p>
            </li>
          ))}
        </ul>
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
