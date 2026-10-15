"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { generateResultsImage } from "@/lib/generate-results-image";
import { isPassingScore } from "@/lib/scoring";
import { clearQuizProgress, getStoredParticipant } from "@/lib/participant-storage";
import SiteHeader from "@/components/SiteHeader";
import type { CorrectedAnswer } from "@/lib/types";

interface LessonQuestionReply {
  id: string;
  sender: "admin" | "participant";
  message: string;
  createdAt: string;
}

interface LessonQuestionThread {
  id: string;
  questionText: string;
  createdAt: string;
  replies: LessonQuestionReply[];
}

interface SuggestionEntry {
  id: string;
  message: string;
  acknowledged: boolean;
  adminResponse: string | null;
  createdAt: string;
}

interface ResultsData {
  quiz: { id: string; title: string };
  participantName: string;
  score: number;
  maxScore: number;
  cancelled: boolean;
  cancelReason: string | null;
  attemptNumber: number;
  officialScore: number | null;
  officialMaxScore: number | null;
  isOfficialAttempt: boolean;
  canRetry: boolean;
  attemptsRemaining: number | null;
  streakDays: number;
  answers: CorrectedAnswer[];
  lessonQuestions: LessonQuestionThread[];
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

/**
 * Carte compacte pour la rangée d'actions du haut (Classement, Mes stats,
 * Copier le lien, Question sur la leçon, Suggestion) : soit un lien, soit un
 * bouton qui bascule un panneau (état "actif" mis en évidence), selon que
 * `href` ou `onClick` est fourni.
 */
function ActionCard({
  icon,
  label,
  href,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const className = `flex w-[86px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center shadow-sm transition-colors ${
    active ? "border-accent bg-accent/5" : "border-navy/15 bg-white hover:border-accent/40"
  }`;
  const content = (
    <>
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-semibold leading-tight text-navy">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [lessonQuestions, setLessonQuestions] = useState<LessonQuestionThread[]>([]);
  // Un seul panneau ouvert à la fois (question OU suggestion) : les deux
  // boutons partagent cet état au lieu d'avoir chacun leur propre booléen,
  // pour ne jamais se retrouver avec les deux ouverts en même temps.
  const [activePanel, setActivePanel] = useState<"question" | "suggestion" | null>(null);
  const showLessonQuestionPanel = activePanel === "question";
  const showSuggestionPanel = activePanel === "suggestion";
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);
  const [replyError, setReplyError] = useState("");
  const [askQuestionText, setAskQuestionText] = useState("");
  const [askQuestionSubmitting, setAskQuestionSubmitting] = useState(false);
  const [askQuestionError, setAskQuestionError] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionSending, setSuggestionSending] = useState(false);
  const [suggestionSent, setSuggestionSent] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [pastSuggestions, setPastSuggestions] = useState<SuggestionEntry[]>([]);

  function loadSuggestions() {
    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) return;
    fetch(`/api/participant/suggestions?deviceKey=${encodeURIComponent(deviceKey)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((resData) => {
        const entries = (resData.suggestions ?? []).map(
          (s: {
            id: string;
            message: string;
            acknowledged: boolean;
            admin_response: string | null;
            created_at: string;
          }) => ({
            id: s.id,
            message: s.message,
            acknowledged: s.acknowledged,
            adminResponse: s.admin_response,
            createdAt: s.created_at,
          })
        );
        setPastSuggestions(entries);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

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
        if (resultsData) {
          setData(resultsData);
          setLessonQuestions(resultsData.lessonQuestions ?? []);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [quizId, token]);

  async function handleShare() {
    if (!data || !passed) return;
    setShareError("");
    setSharing(true);

    let shareLink = "https://quiz.mefzogbadje.org/";
    let resultVisual: Parameters<typeof generateResultsImage>[0]["visual"];
    let siteName = "Quiz Biblique MEF";
    try {
      const brandRes = await fetch("/api/site-brand");
      if (brandRes.ok) {
        const brand = await brandRes.json();
        siteName = brand.siteName || siteName;
        if (brand.quizShareDirectLinkEnabled) {
          shareLink = `https://quiz.mefzogbadje.org/quiz?quiz=${encodeURIComponent(data.quiz.id)}`;
        }
        resultVisual = {
          template: brand.resultShareTemplate,
          customBackground: brand.resultShareCustomBackground,
          customTextColor: brand.resultShareCustomTextColor,
          customTitleY: brand.resultShareCustomTitleY,
          customNameY: brand.resultShareCustomNameY,
          customScoreY: brand.resultShareCustomScoreY,
          mode: "daily",
          config: brand.resultShareDailyConfig,
        };
      }
    } catch {
      // Lien par défaut (accueil) conservé en cas d'échec de la requête.
    }
    const message = `J'ai obtenu ${data.score}/${data.maxScore} au quiz « ${data.quiz.title} » ! ⁉️ Teste tes connaissances toi aussi : ${shareLink}`;

    try {
      const blob = await generateResultsImage({
        participantName: data.participantName || "Participant",
        score: data.score,
        maxScore: data.maxScore,
        quizTitle: data.quiz.title,
        attemptNumber: data.attemptNumber,
        siteName,
        visual: resultVisual,
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

  async function handleSendReply(questionId: string) {
    const message = (replyDrafts[questionId] || "").trim();
    if (!message) return;
    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) return;

    setReplySending(questionId);
    setReplyError("");
    try {
      const res = await fetch(`/api/quiz/${quizId}/lesson-question/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, message }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Erreur lors de l'envoi.");
      }
      setLessonQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, replies: [...q.replies, resData.reply] } : q
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [questionId]: "" }));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setReplySending(null);
    }
  }

  function loadLessonQuestions() {
    fetch(`/api/quiz/${quizId}/results/${token}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((resultsData: ResultsData | null) => {
        if (resultsData) setLessonQuestions(resultsData.lessonQuestions ?? []);
      })
      .catch(() => {});
  }

  async function handleAskQuestion() {
    const questionText = askQuestionText.trim();
    if (!questionText) return;
    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) return;

    setAskQuestionSubmitting(true);
    setAskQuestionError("");
    try {
      const res = await fetch(`/api/quiz/${quizId}/lesson-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, questionText }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Erreur lors de l'envoi.");
      }
      setAskQuestionText("");
      loadLessonQuestions();
    } catch (err) {
      setAskQuestionError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setAskQuestionSubmitting(false);
    }
  }

  async function handleSendSuggestion() {
    const message = suggestionText.trim();
    if (!message) return;
    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) return;

    setSuggestionSending(true);
    setSuggestionError("");
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, message }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Erreur lors de l'envoi.");
      }
      setSuggestionSent(true);
      setSuggestionText("");
      loadSuggestions();
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSuggestionSending(false);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/quiz/${quizId}/resultats/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-screen items-center justify-center px-6">
          <p className="text-gray-500">Chargement des résultats...</p>
        </main>
      </>
    );
  }

  if (wasReset) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-gray-600">
            Ce résultat a été réinitialisé. Tu peux reprendre le quiz depuis le début.
          </p>
          <Link href={`/quiz/${quizId}`} className="btn-primary mt-6">
            🔁 Reprendre le quiz
          </Link>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-gray-600">{error || "Résultats introuvables."}</p>
          <Link href="/" className="btn-secondary mt-6">
            Retour à l&apos;accueil
          </Link>
        </main>
      </>
    );
  }

  const passed = !data.cancelled && isPassingScore(data.score, data.maxScore);

  return (
    <>
      <SiteHeader />
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
        {!data.cancelled && data.isOfficialAttempt && (
          <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 px-4 py-4 text-center text-sm text-green-900">
            <p className="font-bold">✅ Cette note est ta note officielle</p>
            <p className="mt-1">
              C&apos;est la première tentative non annulée. Elle est retenue pour ta moyenne pédagogique et, le cas échéant, pour le classement trimestriel.
            </p>
          </div>
        )}
        {!data.cancelled && !data.isOfficialAttempt && data.officialScore !== null && (
          <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-4 text-center text-sm text-blue-900">
            <p className="font-bold">📘 Tentative d&apos;entraînement</p>
            <p className="mt-1">
              Ta note officielle reste <strong>{data.officialScore}/{data.officialMaxScore}</strong>. Cette reprise sert à apprendre et ne remplace pas la première note.
            </p>
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
                    {data.attemptsRemaining === null
                      ? "Tu peux reprendre ce quiz librement pour t'entraîner. Ta première note reste la note officielle."
                      : <>Tu peux encore t&apos;entraîner. Il te reste{" "}
                          <strong>
                            {data.attemptsRemaining} tentative{data.attemptsRemaining > 1 ? "s" : ""}
                          </strong>{" "}
                          pour ce quiz !
                        </>}
                  </p>
                  <Link href={`/quiz/${quizId}?retry=1`} className="btn-primary mt-4 inline-flex">
                    🔁 Reprendre le quiz
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {passed && (
          <div className="mb-6 flex flex-col items-center gap-2">
            <button onClick={handleShare} disabled={sharing} className="btn-accent">
              {sharing ? "Préparation de l'image..." : "📤 Partager mon score"}
            </button>
            {shareError && <p className="text-xs font-medium text-red-500">{shareError}</p>}
          </div>
        )}

        <section className="mb-8 rounded-3xl border-2 border-blue-100 bg-blue-50/70 p-6 text-center shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Résultat enregistré</p>
          <h2 className="mt-2 text-2xl font-black text-navy">Retrouve tous tes détails dans ton tableau de bord</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-700">
            Tu y trouveras ton historique complet, tes notes officielles et d&apos;entraînement, tes statistiques et la correction détaillée de cette tentative.
          </p>
          <Link
            href={`/mes-stats?quizId=${encodeURIComponent(quizId)}&token=${encodeURIComponent(token)}`}
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-navy px-6 py-4 text-base font-extrabold text-white shadow-lg transition-opacity hover:opacity-90"
          >
            📊 Aller sur mon tableau de bord
          </Link>
        </section>

        <div className="mb-8 flex flex-wrap justify-center gap-3">
          <Link href={`/quiz/${quizId}/classement`} className="btn-secondary">🏆 Voir le classement</Link>
          {data.canRetry && <Link href={`/quiz/${quizId}?retry=1`} className="btn-primary">🔁 Reprendre le quiz</Link>}
          <button type="button" onClick={handleCopyLink} className="btn-secondary">
            {linkCopied ? "✅ Lien copié" : "🔗 Copier le lien du résultat"}
          </button>
        </div>

        <div className="mt-10 flex justify-center">
          <Link href="/" className="btn-secondary">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
      </main>
    </>
  );
}
