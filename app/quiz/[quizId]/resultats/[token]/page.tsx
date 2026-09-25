"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { generateResultsImage } from "@/lib/generate-results-image";
import { isPassingScore } from "@/lib/scoring";
import { clearQuizProgress, getStoredParticipant } from "@/lib/participant-storage";
import type { CorrectedAnswer } from "@/lib/types";

interface ResultsData {
  quiz: { id: string; title: string; lesson_date: string };
  participantName: string;
  score: number;
  maxScore: number;
  cancelled: boolean;
  cancelReason: string | null;
  attemptNumber: number;
  canRetry: boolean;
  attemptsRemaining: number;
  streakDays: number;
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
  const params = useParams<{ quizId: string; token: string }>();
  const quizId = params.quizId;
  const token = params.token;

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wasReset, setWasReset] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    try {
      const flagKey = `quiz_time_expired_${quizId}`;
      if (window.sessionStorage.getItem(flagKey) === "1") {
        setTimeExpired(true);
        window.sessionStorage.removeItem(flagKey);
      }
    } catch {
      // stockage indisponible, on n'affiche simplement pas le message
    }

    fetch(`/api/quiz/${quizId}/results/${token}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            // La soumission n'existe plus (réinitialisation par l'admin) :
            // on efface tout le cache local de progression de CE quiz pour
            // que la personne reparte proprement de l'écran de départ, même
            // sur ce même appareil — sinon elle resterait bloquée sur un
            // ancien résultat en cache.
            const deviceKey = getStoredParticipant()?.deviceKey;
            if (deviceKey) clearQuizProgress(quizId, deviceKey);
            setWasReset(true);
            return null;
          }
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Résultats introuvables.");
        }
        return res.json();
      })
      .then((resultsData: ResultsData | null) => {
        if (resultsData) setData(resultsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [quizId, token]);

  async function handleShare() {
    if (!data || !passed) return;
    setShareError("");
    setSharing(true);

    const message = `J'ai obtenu ${data.score}/${data.maxScore} au Quiz Biblique du ${new Date(
      data.quiz.lesson_date
    ).toLocaleDateString("fr-FR")} ! ⁉️ Teste tes connaissances toi aussi sur quiz.mefzogbadje.org`;

    try {
      const blob = await generateResultsImage({
        participantName: data.participantName || "Participant",
        score: data.score,
        maxScore: data.maxScore,
        quizTitle: data.quiz.title,
        lessonDate: data.quiz.lesson_date,
        attemptNumber: data.attemptNumber,
      });
      const file = new File([blob], "quiz-biblique.png", { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Quiz Biblique", text: message });
        return;
      }

      // Repli : télécharger l'image puis ouvrir WhatsApp avec le texte, pour un partage manuel.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quiz-biblique.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // L'utilisateur a annulé le partage natif, rien à faire.
        return;
      }
      setShareError("Impossible de générer l'image, partage du score en texte seulement.");
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-gray-500">Chargement des résultats...</p>
      </main>
    );
  }

  if (wasReset) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-600">
          Ce résultat a été réinitialisé. Tu peux reprendre le quiz depuis le début.
        </p>
        <Link href={`/quiz/${quizId}`} className="btn-primary mt-6">
          🔁 Reprendre le quiz
        </Link>
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

  const passed = !data.cancelled && isPassingScore(data.score, data.maxScore);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {data.cancelled && (
          <div className="mb-6 rounded-xl border-2 border-accent bg-accent/10 px-4 py-3 text-center text-sm font-medium text-accent-dark">
            ⚠️ Ce test a été annulé automatiquement : la page a été quittée à plusieurs reprises
            pendant le quiz. Voici le détail des réponses données jusque-là.
          </div>
        )}
        {!data.cancelled && timeExpired && (
          <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
            ⏱️ Ton test a été envoyé automatiquement car le temps était écoulé.
          </div>
        )}
        <div className="mb-8 text-center">
          {passed ? (
            <div
              className="relative mx-auto max-w-md overflow-hidden rounded-3xl px-8 py-10 text-white shadow-2xl"
              style={{
                background: "linear-gradient(155deg, #1a2e5a 0%, #101d3d 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(185,28,28,0.35), transparent 70%)" }}
              />
              <div
                className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(220,38,38,0.25), transparent 70%)" }}
              />
              <div className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent-light to-accent text-4xl shadow-lg shadow-accent/40">
                🎉
              </div>
              {data.attemptNumber > 1 && (
                <span className="relative mb-2 inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                  🔁 {data.attemptNumber}ᵉ tentative
                </span>
              )}
              <p className="relative text-xs font-semibold uppercase tracking-wide text-white/60">
                {data.quiz.title}
              </p>
              <h2 className="relative mt-2 text-2xl font-extrabold sm:text-3xl">
                Félicitations{data.participantName ? `, ${data.participantName}` : ""} !
              </h2>
              <p className="relative mt-1 text-sm text-white/70">
                Tu as réussi le quiz avec brio.
              </p>
              <div className="relative mt-6 inline-flex flex-col items-center rounded-2xl border border-white/20 bg-white/5 px-8 py-4 backdrop-blur">
                <span className="text-xs uppercase tracking-wide text-white/60">
                  Score total
                </span>
                <span className="text-4xl font-extrabold">
                  {data.score} / {data.maxScore}
                </span>
              </div>
              {data.streakDays >= 2 && (
                <p className="relative mt-4 text-sm font-semibold text-white/80">
                  🔥 {data.streakDays} jours d&apos;affilée !
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
                {data.quiz.title}
              </p>
              {data.attemptNumber > 1 && (
                <span className="mt-2 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-dark">
                  🔁 {data.attemptNumber}ᵉ tentative
                </span>
              )}
              {data.participantName && (
                <p className="mt-1 text-gray-500">
                  Merci d&apos;avoir participé, {data.participantName}.
                </p>
              )}
              <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl border-2 border-accent bg-white px-10 py-6 shadow-sm">
                <span className="text-sm font-medium text-gray-500">Score total</span>
                <span className="text-4xl font-extrabold text-navy">
                  {data.score} / {data.maxScore}
                </span>
              </div>
              {data.streakDays >= 2 && (
                <p className="mt-3 text-sm font-semibold text-accent-dark">
                  🔥 {data.streakDays} jours d&apos;affilée !
                </p>
              )}
              {data.canRetry && (
                <div className="mx-auto mt-6 max-w-sm rounded-2xl border-2 border-dashed border-navy/20 bg-navy/5 px-6 py-5">
                  <p className="text-sm text-navy">
                    Tu n&apos;as pas encore atteint la moyenne. Il te reste{" "}
                    <strong>
                      {data.attemptsRemaining} tentative{data.attemptsRemaining > 1 ? "s" : ""}
                    </strong>{" "}
                    pour ce quiz !
                  </p>
                  <Link href={`/quiz/${quizId}`} className="btn-primary mt-4 inline-flex">
                    🔁 Reprendre le quiz
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {passed && (
          <div className="mb-8 flex flex-col items-center gap-2">
            <button onClick={handleShare} disabled={sharing} className="btn-accent">
              {sharing ? "Préparation de l'image..." : "📤 Partager mon score"}
            </button>
            {shareError && <p className="text-xs font-medium text-red-500">{shareError}</p>}
          </div>
        )}

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

              {answer.isCorrect === false && answer.correctOption === null && answer.correctText === null ? (
                <p className="text-sm italic text-gray-400">
                  🔒 Réessaie pour découvrir la bonne réponse
                </p>
              ) : (
                answer.type !== "open" && (
                  <p className="text-sm text-gray-700">
                    <strong>Bonne réponse :</strong> {formatCorrectAnswer(answer)}
                  </p>
                )
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
