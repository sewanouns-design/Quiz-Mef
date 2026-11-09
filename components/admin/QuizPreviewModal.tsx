"use client";

import { useEffect, useState } from "react";

interface PreviewQuestion {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  correct_option: number | null;
  correct_text: string | null;
  justification: string | null;
  points: number;
  position: number;
}

interface PreviewQuiz {
  id: string;
  title: string;
  subtitle: string | null;
  quiz_mode: "overview" | "sequential";
  duration_seconds: number | null;
}

/**
 * Aperçu en lecture seule d'un quiz tel qu'un participant le verrait, avec
 * en plus la bonne réponse mise en évidence et la justification — pour que
 * l'admin puisse relire le contenu sans avoir à ouvrir le formulaire
 * d'édition ni à passer réellement le quiz.
 */
export default function QuizPreviewModal({
  quizId,
  onClose,
}: {
  quizId: string;
  onClose: () => void;
}) {
  const [quiz, setQuiz] = useState<PreviewQuiz | null>(null);
  const [questions, setQuestions] = useState<PreviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/quiz/${quizId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Erreur lors du chargement du quiz.");
        setQuiz(data.quiz);
        setQuestions(
          [...(data.questions ?? [])].sort(
            (a: PreviewQuestion, b: PreviewQuestion) => a.position - b.position
          )
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, [quizId]);

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy">👁️ Aperçu du quiz</h2>
            {quiz && (
              <>
                <p className="mt-1 font-semibold text-navy">{quiz.title}</p>
                {quiz.subtitle && <p className="text-sm text-gray-500">{quiz.subtitle}</p>}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Chargement...</p>
        ) : error ? (
          <p className="text-sm font-medium text-red-600">{error}</p>
        ) : questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            Ce quiz ne contient aucune question.
          </p>
        ) : (
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {questions.length} question{questions.length > 1 ? "s" : ""} · {totalPoints} points ·{" "}
              {quiz?.quiz_mode === "sequential" ? "mode séquentiel" : "aperçu global"}
            </p>
            <ol className="space-y-5">
              {questions.map((q, index) => (
                <li key={q.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="font-semibold text-navy">
                      {index + 1}. {q.question}
                    </p>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {q.points} pt{q.points > 1 ? "s" : ""}
                    </span>
                  </div>

                  {q.options && q.options.length > 0 ? (
                    <ul className="space-y-1.5">
                      {q.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === q.correct_option;
                        return (
                          <li
                            key={optionIndex}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              isCorrect
                                ? "border-green-300 bg-green-50 font-semibold text-green-800"
                                : "border-gray-150 text-gray-600"
                            }`}
                          >
                            {isCorrect && <span className="mr-1.5">✓</span>}
                            {option}
                          </li>
                        );
                      })}
                    </ul>
                  ) : q.correct_text ? (
                    <p className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                      ✓ Réponse attendue : {q.correct_text}
                    </p>
                  ) : (
                    <p className="text-sm italic text-gray-400">Question ouverte, sans correction automatique.</p>
                  )}

                  {q.justification && (
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      <span className="font-semibold">Justification :</span> {q.justification}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
