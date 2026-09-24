"use client";

import { useEffect, useState } from "react";
import ParticipantDetailModal from "./ParticipantDetailModal";

interface LessonQuestionEntry {
  id: string;
  question_text: string;
  created_at: string;
  participant: { id: string; name: string; parish: string } | null;
}

export default function LessonQuestionsModal({
  quizId,
  quizTitle,
  onClose,
}: {
  quizId: string;
  quizTitle: string;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<LessonQuestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/lesson-questions?quizId=${encodeURIComponent(quizId)}`, {
      cache: "no-store",
    })
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
  }, [quizId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">Questions sur la leçon</h2>
            <p className="text-sm text-gray-500">{quizTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Chargement...</p>
        ) : error ? (
          <div>
            <p className="text-sm font-medium text-red-600">{error}</p>
            {error.includes("Session expirée") && (
              <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
                Se reconnecter →
              </a>
            )}
          </div>
        ) : questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Aucune question posée pour ce quiz.
          </p>
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
                <p className="text-sm text-gray-700">{q.question_text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          onClose={() => setSelectedParticipantId(null)}
        />
      )}
    </div>
  );
}
