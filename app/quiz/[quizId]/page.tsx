"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrCreateDeviceKey, getStoredParticipant } from "@/lib/participant-storage";
import type { PublicQuestion } from "@/lib/types";

interface QuizData {
  quiz: { id: string; title: string; lesson_date: string; is_active: boolean };
  questions: PublicQuestion[];
  alreadySubmitted: boolean;
}

type AnswersState = Record<string, { selectedOption?: number; answerText?: string }>;

export default function QuizPage() {
  const router = useRouter();
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;

  const [deviceKey, setDeviceKey] = useState("");
  const [data, setData] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const participant = getStoredParticipant();
    if (!participant?.name) {
      router.replace("/quiz");
      return;
    }

    const key = getOrCreateDeviceKey();
    setDeviceKey(key);

    fetch(`/api/quiz/${quizId}?deviceKey=${encodeURIComponent(key)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Impossible de charger le quiz.");
        }
        return res.json();
      })
      .then((quizData: QuizData) => {
        if (quizData.alreadySubmitted) {
          router.replace(`/quiz/${quizId}/resultats`);
          return;
        }
        setData(quizData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const totalPoints = useMemo(
    () => data?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0,
    [data]
  );

  function setSelectedOption(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: { selectedOption: optionIndex } }));
  }

  function setAnswerText(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { answerText: text } }));
  }

  async function handleSubmit() {
    if (!data) return;
    setError("");
    setSubmitting(true);

    try {
      const payload = data.questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id]?.selectedOption,
        answerText: answers[q.id]?.answerText,
      }));

      const res = await fetch(`/api/quiz/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, answers: payload }),
      });

      if (res.status === 409) {
        router.replace(`/quiz/${quizId}/resultats`);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la soumission.");
      }

      router.push(`/quiz/${quizId}/resultats`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-gray-500">Chargement du quiz...</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-600">{error}</p>
      </main>
    );
  }

  if (!data) return null;

  const answeredCount = Object.keys(answers).length;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
            {new Date(data.quiz.lesson_date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">
            {data.quiz.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {data.questions.length} questions · {totalPoints} points · {answeredCount} répondue(s)
          </p>
        </div>

        <div className="space-y-6">
          {data.questions.map((question, index) => (
            <div key={question.id} className="card">
              <div className="mb-3 flex items-start justify-between gap-4">
                <p className="font-semibold text-navy">
                  {index + 1}. {question.question}
                </p>
                <span className="whitespace-nowrap rounded-full bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy">
                  {question.points} pt{question.points > 1 ? "s" : ""}
                </span>
              </div>

              {(question.type === "mcq" || question.type === "true_false") &&
                question.options && (
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => {
                      const selected = answers[question.id]?.selectedOption === optIndex;
                      return (
                        <button
                          type="button"
                          key={optIndex}
                          onClick={() => setSelectedOption(question.id, optIndex)}
                          className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                            selected
                              ? "border-accent bg-accent/10 font-semibold text-navy"
                              : "border-gray-200 text-gray-700 hover:border-accent/50"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

              {(question.type === "short" || question.type === "fill_blank") && (
                <input
                  className="input-field"
                  placeholder="Ta réponse"
                  value={answers[question.id]?.answerText ?? ""}
                  onChange={(e) => setAnswerText(question.id, e.target.value)}
                />
              )}

              {question.type === "open" && (
                <textarea
                  className="input-field min-h-[100px]"
                  placeholder="Ta réponse"
                  value={answers[question.id]?.answerText ?? ""}
                  onChange={(e) => setAnswerText(question.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-8">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Envoi en cours..." : "Soumettre mes réponses"}
          </button>
        </div>
      </div>
    </main>
  );
}
