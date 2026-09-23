"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getOrCreateDeviceKey, getStoredParticipant } from "@/lib/participant-storage";
import type { CorrectedAnswer } from "@/lib/types";

interface ResultsData {
  quiz: { id: string; title: string; lesson_date: string };
  score: number;
  maxScore: number;
  answers: CorrectedAnswer[];
}

function formatParticipantAnswer(answer: CorrectedAnswer): string {
  if (answer.type === "mcq" || answer.type === "true_false") {
    if (answer.participantSelectedOption === null) return "Pas de réponse";
    return answer.options?.[answer.participantSelectedOption] ?? "—";
  }
  return answer.participantAnswerText || "Pas de réponse";
}

function formatCorrectAnswer(answer: CorrectedAnswer): string {
  if (answer.type === "mcq" || answer.type === "true_false") {
    if (answer.correctOption === null) return "—";
    return answer.options?.[answer.correctOption] ?? "—";
  }
  return answer.correctText || "—";
}

export default function ResultsPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [participantName, setParticipantName] = useState("");

  useEffect(() => {
    const participant = getStoredParticipant();
    setParticipantName(participant?.name || "");
    const key = getOrCreateDeviceKey();

    fetch(`/api/quiz/${quizId}/results?deviceKey=${encodeURIComponent(key)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Résultats introuvables.");
        }
        return res.json();
      })
      .then((resultsData: ResultsData) => setData(resultsData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [quizId]);

  function handleShare() {
    if (!data) return;
    const message = `J'ai obtenu ${data.score}/${data.maxScore} au Quiz Biblique MEF du ${new Date(
      data.quiz.lesson_date
    ).toLocaleDateString("fr-FR")} ! ⁉️ Teste tes connaissances toi aussi sur quiz.mefzogbadje.org`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-gray-500">Chargement des résultats...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-600">{error || "Résultats introuvables."}</p>
        <Link href="/" className="btn-secondary mt-6">
          Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  const passed = data.maxScore > 0 && data.score / data.maxScore >= 0.6;

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          {passed ? (
            <div className="mx-auto max-w-md rounded-2xl bg-navy px-8 py-10 text-white shadow-lg">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-3xl">
                🎉
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                {data.quiz.title}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold">
                Félicitations{participantName ? `, ${participantName}` : ""} !
              </h2>
              <p className="mt-1 text-sm text-white/70">
                Tu as réussi le quiz avec brio.
              </p>
              <div className="mt-6 inline-flex flex-col items-center rounded-xl border border-white/20 px-8 py-4">
                <span className="text-xs uppercase tracking-wide text-white/60">
                  Score total
                </span>
                <span className="text-4xl font-extrabold">
                  {data.score} / {data.maxScore}
                </span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
                {data.quiz.title}
              </p>
              {participantName && (
                <p className="mt-1 text-gray-500">Merci d&apos;avoir participé, {participantName}.</p>
              )}
              <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl border-2 border-accent bg-white px-10 py-6 shadow-sm">
                <span className="text-sm font-medium text-gray-500">Score total</span>
                <span className="text-4xl font-extrabold text-navy">
                  {data.score} / {data.maxScore}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mb-8 flex justify-center">
          <button onClick={handleShare} className="btn-accent">
            Partager mon score
          </button>
        </div>

        <div className="space-y-4">
          {data.answers.map((answer, index) => (
            <div key={answer.questionId} className="card">
              <div className="mb-2 flex items-start justify-between gap-4">
                <p className="font-semibold text-navy">
                  {answer.type === "open" ? "✍️" : answer.isCorrect ? "✅" : "❌"}{" "}
                  {index + 1}. {answer.question}
                </p>
                <span className="whitespace-nowrap rounded-full bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy">
                  {answer.pointsAwarded}/{answer.points} pt
                </span>
              </div>

              <p className="text-sm text-gray-700">
                <strong>Ta réponse :</strong> {formatParticipantAnswer(answer)}
              </p>

              {answer.type !== "open" && (
                <p className="text-sm text-gray-700">
                  <strong>Bonne réponse :</strong> {formatCorrectAnswer(answer)}
                </p>
              )}

              {answer.justification && (
                <p className="mt-2 rounded-lg bg-navy/5 p-3 text-sm text-gray-600">
                  <strong>Justification :</strong> {answer.justification}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/" className="btn-secondary">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
