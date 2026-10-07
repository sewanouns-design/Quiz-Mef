"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getOrCreateAnonymousDeviceKey } from "@/lib/participant-storage";

interface ReferenceQuestion {
  type: "reference";
  verseId: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
}

interface CompleteQuestion {
  type: "complete";
  verseId: string;
  reference: string;
  before: string;
  after: string;
  options: string[];
  correctAnswer: string;
}

type Question = ReferenceQuestion | CompleteQuestion;

interface LeaderboardEntry {
  displayName: string;
  score: number;
  total: number;
}

const QUESTIONS_PER_GAME = 8;
const LEADERBOARD_POLL_MS = 10000;
const MEDALS = ["🥇", "🥈", "🥉"];

function scoreMessage(score: number, total: number): string {
  const percent = (score / total) * 100;
  if (percent === 100) return "Parfait ! Tu connais vraiment bien tes versets. 🏆";
  if (percent >= 70) return "Très bien joué ! 👏";
  if (percent >= 40) return "Pas mal, continue à t'entraîner ! 💪";
  return "Rejoue pour mieux les retenir. 📖";
}

export default function VerseGamePage() {
  const [deviceKey, setDeviceKey] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  const [myRank, setMyRank] = useState<number | null>(null);
  const [myBestScore, setMyBestScore] = useState<number | null>(null);
  const [myBestTotal, setMyBestTotal] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [justBeatBest, setJustBeatBest] = useState(false);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  function loadLeaderboard(key: string) {
    setLeaderboardLoading(true);
    fetch(`/api/verse-game/leaderboard?deviceKey=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          entries: LeaderboardEntry[];
          totalPlayers: number;
          myRank: number | null;
          myScore: number | null;
          myTotal: number | null;
        } | null) => {
          if (!data) return;
          setLeaderboardEntries(data.entries ?? []);
          setTotalPlayers(data.totalPlayers ?? 0);
          setMyRank(data.myRank);
          setMyBestScore(data.myScore);
          setMyBestTotal(data.myTotal);
        }
      )
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));
  }

  function loadGame() {
    setLoading(true);
    setError("");
    setIndex(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
    setJustBeatBest(false);
    fetch(`/api/verse-game/questions?count=${QUESTIONS_PER_GAME}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement du jeu.");
        }
        setQuestions(data.questions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const key = getOrCreateAnonymousDeviceKey();
    setDeviceKey(key);
    loadLeaderboard(key);
    loadGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rafraîchit le classement toutes les 10s tant que le panneau est ouvert,
  // pour donner une impression de classement "en direct".
  useEffect(() => {
    if (!showLeaderboard || !deviceKey) return;
    const poll = setInterval(() => loadLeaderboard(deviceKey), LEADERBOARD_POLL_MS);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeaderboard, deviceKey]);

  const current = questions[index];

  function handleAnswer(option: string) {
    if (!current || selected) return;
    setSelected(option);
    if (option === current.correctAnswer) {
      setScore((s) => s + 1);
    }
  }

  async function handleNext() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      if (deviceKey) {
        try {
          const res = await fetch("/api/verse-game/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ deviceKey, score, total: questions.length }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setJustBeatBest(Boolean(data.isNewBest));
            setMyRank(data.rank ?? null);
            setMyBestScore(data.bestScore ?? null);
            setMyBestTotal(questions.length);
            loadLeaderboard(deviceKey);
          }
        } catch {
          // Score non enregistré, tant pis — le jeu reste jouable.
        }
      }
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  return (
    <>
      <SiteHeader />
      <main className="flex min-h-screen flex-col items-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
              📖
            </div>
            <h1 className="text-2xl font-bold text-navy">Trouve le verset</h1>
            <p className="mt-1 text-gray-600">
              Devine la référence ou complète le texte — joue autant de fois que tu veux.
            </p>
          </div>

          <div className="mb-6 flex flex-wrap justify-center gap-3">
            {myBestScore !== null && (
              <div className="rounded-2xl border-2 border-navy/15 bg-white px-4 py-2.5 text-center text-sm font-semibold text-navy shadow-sm">
                🌟 Meilleur score : {myBestScore} / {myBestTotal}
                {myRank && <span className="text-gray-400"> · #{myRank}</span>}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowLeaderboard((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                showLeaderboard
                  ? "border-accent bg-accent/5 text-navy"
                  : "border-navy/15 bg-white text-navy hover:border-accent/40"
              }`}
            >
              🏆 Classement{totalPlayers > 0 ? ` (${totalPlayers})` : ""}
            </button>
          </div>

          {showLeaderboard && (
            <div className="mb-6 card">
              <h2 className="mb-3 text-sm font-bold text-navy">🏆 Classement en direct</h2>
              {leaderboardLoading && leaderboardEntries.length === 0 ? (
                <p className="text-center text-sm text-gray-400">Chargement...</p>
              ) : leaderboardEntries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
                  Personne n&apos;a encore choisi d&apos;apparaître dans ce classement.
                </p>
              ) : (
                <ol className="space-y-2">
                  {leaderboardEntries.map((e, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                        i < 3 ? "border-accent bg-accent/10" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center font-bold text-navy">
                          {MEDALS[i] ?? i + 1}
                        </span>
                        <span className="font-semibold text-navy">{e.displayName}</span>
                      </div>
                      <span className="font-bold text-navy">
                        {e.score} / {e.total}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {myRank && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  Ton rang actuel : <span className="font-semibold text-accent-dark">#{myRank}</span> sur{" "}
                  {totalPlayers}. Pour apparaître avec ton prénom ici, active &quot;Afficher mon prénom
                  dans le classement&quot; en répondant à un quiz.
                </p>
              )}
            </div>
          )}

          {loading && <p className="text-center text-gray-400">Chargement...</p>}

          {!loading && error && (
            <div className="card text-center">
              <p className="text-sm font-medium text-red-600">{error}</p>
              <button type="button" onClick={loadGame} className="btn-secondary mt-4">
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && finished && (
            <div className="card text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
                Partie terminée
              </p>
              <p className="mt-2 text-4xl font-extrabold text-navy">
                {score} / {questions.length}
              </p>
              {justBeatBest && (
                <p className="mt-1 text-sm font-semibold text-accent-dark">🎉 Nouveau meilleur score !</p>
              )}
              {myRank && (
                <p className="mt-1 text-sm text-gray-500">
                  Tu es #{myRank} sur {totalPlayers}
                </p>
              )}
              <p className="mt-3 text-gray-600">{scoreMessage(score, questions.length)}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button type="button" onClick={loadGame} className="btn-accent">
                  🔁 Rejouer
                </button>
                <Link href="/" className="btn-secondary">
                  🏠 Accueil
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && !finished && current && (
            <div className="card">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Question {index + 1} / {questions.length} · Score : {score}
              </p>

              {current.type === "reference" ? (
                <>
                  <h2 className="mb-4 text-sm font-bold text-navy">
                    Quelle est la référence de ce verset ?
                  </h2>
                  <p className="mb-5 rounded-xl bg-navy/5 p-4 text-center italic text-navy">
                    « {current.prompt} »
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mb-1 text-sm font-bold text-navy">Complète le verset</h2>
                  <p className="mb-4 text-xs text-gray-400">{current.reference}</p>
                  <p className="mb-5 rounded-xl bg-navy/5 p-4 text-center italic text-navy">
                    « {current.before}
                    <span className="font-bold not-italic text-accent-dark">______</span>
                    {current.after} »
                  </p>
                </>
              )}

              <div className="space-y-2">
                {current.options.map((option) => {
                  const isCorrect = option === current.correctAnswer;
                  const isSelected = option === selected;
                  const showResult = selected !== null;

                  let className =
                    "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ";
                  if (!showResult) {
                    className += "border-gray-200 text-gray-700 hover:border-blue-200";
                  } else if (isCorrect) {
                    className += "border-green-400 bg-green-50 font-semibold text-green-700";
                  } else if (isSelected) {
                    className += "border-red-400 bg-red-50 font-semibold text-red-700";
                  } else {
                    className += "border-gray-200 text-gray-400";
                  }

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      disabled={showResult}
                      className={className}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {selected !== null && (
                <button type="button" onClick={handleNext} className="btn-primary mt-6 w-full">
                  {index + 1 >= questions.length ? "Voir mon score" : "Suivant →"}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
