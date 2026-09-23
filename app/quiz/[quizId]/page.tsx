"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrCreateDeviceKey, getStoredParticipant } from "@/lib/participant-storage";
import type { PublicQuestion } from "@/lib/types";

interface QuizData {
  quiz: {
    id: string;
    title: string;
    lesson_date: string;
    is_active: boolean;
    time_limit_minutes: number | null;
  };
  questions: PublicQuestion[];
  alreadySubmitted: boolean;
}

type AnswersState = Record<string, { selectedOption?: number; answerText?: string }>;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const LEAVE_THRESHOLD_MS = 5000;

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

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  const [lessonQuestionText, setLessonQuestionText] = useState("");
  const [lessonQuestionSubmitting, setLessonQuestionSubmitting] = useState(false);
  const [lessonQuestionSent, setLessonQuestionSent] = useState(false);
  const [lessonQuestionError, setLessonQuestionError] = useState("");

  const hiddenAtRef = useRef<number | null>(null);
  const leaveCountRef = useRef(0);
  const dataRef = useRef<QuizData | null>(null);
  const answersRef = useRef<AnswersState>({});
  const submittingRef = useRef(false);
  const deviceKeyRef = useRef("");

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  useEffect(() => {
    deviceKeyRef.current = deviceKey;
  }, [deviceKey]);

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

  async function handleSubmit(options?: { cancelled?: boolean; reason?: string }) {
    const currentData = dataRef.current;
    if (!currentData || submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setSubmitting(true);

    try {
      const currentAnswers = answersRef.current;
      const payload = currentData.questions.map((q) => ({
        questionId: q.id,
        selectedOption: currentAnswers[q.id]?.selectedOption,
        answerText: currentAnswers[q.id]?.answerText,
      }));

      const res = await fetch(`/api/quiz/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          deviceKey: deviceKeyRef.current,
          answers: payload,
          cancelled: options?.cancelled ?? false,
          cancelReason: options?.reason ?? null,
        }),
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
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // Compte à rebours
  useEffect(() => {
    if (!data?.quiz.time_limit_minutes || !deviceKey) return;

    const storageKey = `quiz_deadline_${quizId}_${deviceKey}`;
    let deadline = Number(window.localStorage.getItem(storageKey));
    if (!deadline || Number.isNaN(deadline)) {
      deadline = Date.now() + data.quiz.time_limit_minutes * 60000;
      try {
        window.localStorage.setItem(storageKey, String(deadline));
      } catch {
        // stockage indisponible, le minuteur reste actif pour cette session
      }
    }

    function tick() {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleSubmit({ reason: "time_expired" });
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, deviceKey, quizId]);

  // Détection de sortie de page (anti-triche)
  useEffect(() => {
    if (!data) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current === null) return;
      const elapsed = Date.now() - hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (elapsed < LEAVE_THRESHOLD_MS) return;

      leaveCountRef.current += 1;
      if (leaveCountRef.current === 1) {
        setShowLeaveWarning(true);
      } else {
        handleSubmit({ cancelled: true, reason: "left_page_multiple_times" });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function handleSendLessonQuestion() {
    if (!lessonQuestionText.trim()) return;
    setLessonQuestionSubmitting(true);
    setLessonQuestionError("");
    try {
      const res = await fetch(`/api/quiz/${quizId}/lesson-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, questionText: lessonQuestionText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi de la question.");
      }
      setLessonQuestionSent(true);
    } catch (err) {
      setLessonQuestionError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLessonQuestionSubmitting(false);
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
        {showLeaveWarning && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border-2 border-accent bg-accent/10 px-4 py-3">
            <p className="text-sm font-medium text-accent-dark">
              ⚠️ Tu as quitté la page du quiz. Si tu recommences, ton test sera automatiquement
              annulé.
            </p>
            <button
              onClick={() => setShowLeaveWarning(false)}
              className="shrink-0 text-accent-dark hover:opacity-70"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        )}

        {remainingSeconds !== null && (
          <div
            className={`mb-6 flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-center font-semibold ${
              remainingSeconds <= 60
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-navy/20 bg-navy/5 text-navy"
            }`}
          >
            <span>⏱️</span>
            <span>Temps restant : {formatTime(remainingSeconds)}</span>
          </div>
        )}

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

        {answeredCount >= 1 && (
          <div className="card mt-6">
            {lessonQuestionSent ? (
              <p className="text-sm font-medium text-green-600">
                ✅ Ta question a bien été envoyée. Merci !
              </p>
            ) : (
              <>
                <h3 className="mb-1 text-sm font-bold text-navy">
                  Une question sur la leçon du jour ?
                </h3>
                <p className="mb-3 text-xs text-gray-500">
                  Profites-en pour la poser ici, elle sera transmise à l&apos;équipe.
                </p>
                <textarea
                  className="input-field min-h-[80px]"
                  placeholder="Écris ta question ici..."
                  value={lessonQuestionText}
                  onChange={(e) => setLessonQuestionText(e.target.value)}
                />
                {lessonQuestionError && (
                  <p className="mt-2 text-sm font-medium text-red-600">{lessonQuestionError}</p>
                )}
                <button
                  type="button"
                  onClick={handleSendLessonQuestion}
                  disabled={lessonQuestionSubmitting || !lessonQuestionText.trim()}
                  className="btn-secondary mt-3"
                >
                  {lessonQuestionSubmitting ? "Envoi..." : "Envoyer ma question"}
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-8">
          <button
            onClick={() => handleSubmit()}
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
