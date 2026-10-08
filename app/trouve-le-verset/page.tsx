"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import {
  getOrCreateAnonymousDeviceKey,
  getOrCreateDeviceKey,
  getStoredParticipant,
  saveStoredParticipant,
} from "@/lib/participant-storage";
import { isValidEmail, isValidName } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import PhoneInput from "@/components/PhoneInput";
import { MAX_LEVEL } from "@/lib/verse-level";

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
  level: number;
}

const QUESTIONS_PER_GAME = 8;
const LEADERBOARD_POLL_MS = 5000;
const AUTO_ADVANCE_DELAY_MS = 900;
const MAX_TICKER_ENTRIES = 10;
const TICKER_ROW_HEIGHT_PX = 40;
const TICKER_VISIBLE_ROWS = 4;
const TICKER_SECONDS_PER_ROW = 2.2;

function scoreMessage(score: number, total: number): string {
  const percent = (score / total) * 100;
  if (percent === 100) return "Parfait ! Tu connais vraiment bien tes versets. 🏆";
  if (percent >= 70) return "Très bien joué ! 👏";
  if (percent >= 40) return "Pas mal, continue à t'entraîner ! 💪";
  return "Rejoue pour mieux les retenir. 📖";
}

/**
 * Bandeau de classement "en direct" : une seule colonne qui défile vers le
 * haut en continu (prénom + points cumulés, triés du plus haut au plus
 * bas), plutôt qu'une liste statique à rafraîchir manuellement. Le contenu
 * est dupliqué pour boucler sans à-coup ; les nouvelles données (sondées
 * toutes les 5s) remplacent la liste en douceur, défilement compris — sans
 * jamais changer la hauteur du bandeau (fixe, voir TICKER_VISIBLE_ROWS), ni
 * la mise en page autour, pour éviter tout "saut" visuel à chaque rafraîchissement.
 */
function LiveLeaderboardTicker({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <p
        className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-400"
        style={{ height: TICKER_ROW_HEIGHT_PX * TICKER_VISIBLE_ROWS }}
      >
        Personne n&apos;a encore choisi d&apos;apparaître dans ce classement.
      </p>
    );
  }

  const limited = entries.slice(0, MAX_TICKER_ENTRIES);
  const doubled = [...limited, ...limited];
  const duration = Math.max(limited.length * TICKER_SECONDS_PER_ROW, 6);

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-navy/5"
      style={{ height: TICKER_ROW_HEIGHT_PX * TICKER_VISIBLE_ROWS }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-white to-transparent" />
      <div
        className="animate-verse-ticker absolute inset-x-0 top-0"
        style={{ animationDuration: `${duration}s` }}
      >
        {doubled.map((e, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3 text-sm"
            style={{ height: TICKER_ROW_HEIGHT_PX }}
          >
            <span className="flex items-center gap-2 font-semibold text-navy">
              <span className="text-xs text-gray-400">#{(i % limited.length) + 1}</span>
              {e.displayName}
            </span>
            <span className="font-bold text-accent-dark">{e.score} pts</span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

/**
 * Porte d'identification : seulement affichée si l'appareil n'a JAMAIS été
 * identifié (ni par le quiz, ni par ce jeu auparavant). Mêmes informations
 * que l'identification du quiz, pour que ce soit la même fiche participant
 * des deux côtés — si la personne a déjà fait un quiz, cet écran n'apparaît
 * jamais : son identité est réutilisée silencieusement.
 */
function IdentificationGate({ onIdentified }: { onIdentified: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showInLeaderboard, setShowInLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Le nom et l'email sont requis.");
      return;
    }
    if (!isValidName(name)) {
      setError("Merci d'indiquer ton vrai nom (lettres uniquement, pas de chiffres ni de symboles).");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Le format de l'email n'est pas valide (ex : nom@exemple.com).");
      return;
    }
    if (!isValidWhatsappValue(whatsapp)) {
      setError("Le format du numéro WhatsApp n'est pas valide.");
      return;
    }

    setLoading(true);
    const deviceKey = getOrCreateDeviceKey();
    try {
      const res = await fetch("/api/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, name, email, whatsapp, showInLeaderboard }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement.");
      }
      saveStoredParticipant({
        deviceKey,
        name: data.participant?.name ?? name,
        address: data.participant?.address ?? "",
        email: data.participant?.email ?? email,
        whatsapp: data.participant?.whatsapp ?? whatsapp,
        showInLeaderboard: data.participant?.show_in_leaderboard ?? showInLeaderboard,
      });
      onIdentified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <p className="mb-4 text-sm text-gray-600">
        Pour jouer, identifie-toi rapidement (comme pour le quiz) — tu n&apos;auras plus à le refaire
        ensuite, ici ou pour le quiz.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label-field" htmlFor="verse-id-name">
            Nom complet
          </label>
          <input
            id="verse-id-name"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="verse-id-email">
            Email
          </label>
          <input
            id="verse-id-email"
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="verse-id-whatsapp">
            WhatsApp (facultatif)
          </label>
          <PhoneInput id="verse-id-whatsapp" initialValue={whatsapp} onChange={setWhatsapp} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInLeaderboard}
            onChange={(e) => setShowInLeaderboard(e.target.checked)}
          />
          Afficher mon prénom dans les classements publics
        </label>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-accent w-full">
          {loading ? "Enregistrement..." : "Commencer à jouer"}
        </button>
      </form>
    </div>
  );
}

export default function VerseGamePage() {
  const [identified, setIdentified] = useState<boolean | null>(null);
  const [deviceKey, setDeviceKey] = useState("");

  const [currentLevel, setCurrentLevel] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [totalPoints, setTotalPoints] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const autoAdvanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const [showLeaderboard, setShowLeaderboard] = useState(true);
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
        } | null) => {
          if (!data) return;
          setLeaderboardEntries(data.entries ?? []);
          setTotalPlayers(data.totalPlayers ?? 0);
          setMyRank(data.myRank);
        }
      )
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));
  }

  function loadProgress(key: string) {
    return fetch(`/api/verse-game/progress?deviceKey=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { currentLevel: number; totalPoints: number } | null) => {
        if (!data) return 1;
        setCurrentLevel(data.currentLevel);
        setSelectedLevel(data.currentLevel);
        setTotalPoints(data.totalPoints);
        return data.currentLevel;
      })
      .catch(() => 1)
      .finally(() => setProgressLoaded(true));
  }

  function loadGame(level: number) {
    setLoading(true);
    setError("");
    setIndex(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
    setJustLeveledUp(false);
    setPointsEarned(0);
    fetch(`/api/verse-game/questions?count=${QUESTIONS_PER_GAME}&level=${level}`, { cache: "no-store" })
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

  function startAsIdentifiedPlayer() {
    // getOrCreateAnonymousDeviceKey() réutilise le deviceKey du participant
    // dès qu'il en existe un (identifié ici ou via le quiz) : même identité
    // des deux côtés, sans jamais redemander l'identification une fois faite.
    const key = getOrCreateAnonymousDeviceKey();
    setDeviceKey(key);
    setIdentified(true);
    loadLeaderboard(key);
    loadProgress(key).then((level) => loadGame(level));
  }

  useEffect(() => {
    const stored = getStoredParticipant();
    if (stored?.name && stored?.deviceKey) {
      startAsIdentifiedPlayer();
    } else {
      setIdentified(false);
      setLoading(false);
    }
    return () => {
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rafraîchit le classement toutes les 5s tant que le panneau est ouvert,
  // pour donner une impression de classement "en direct".
  useEffect(() => {
    if (!showLeaderboard || !deviceKey) return;
    const poll = setInterval(() => loadLeaderboard(deviceKey), LEADERBOARD_POLL_MS);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeaderboard, deviceKey]);

  const current = questions[index];

  // Bonne réponse : avance automatiquement après un court délai (le temps de
  // voir la case passer au vert), pas besoin de cliquer sur "Suivant".
  // Mauvaise réponse : on reste sur la question, la bonne réponse s'affiche
  // en vert, et c'est à la personne de cliquer sur "Suivant" pour continuer.
  function handleAnswer(option: string) {
    if (!current || selected) return;
    setSelected(option);
    if (option === current.correctAnswer) {
      setScore((s) => s + 1);
      autoAdvanceTimeout.current = setTimeout(() => handleNext(), AUTO_ADVANCE_DELAY_MS);
    }
  }

  async function handleNext() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      if (deviceKey) {
        try {
          const res = await fetch("/api/verse-game/level-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ deviceKey, level: selectedLevel, score, total: questions.length }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setPointsEarned(data.pointsEarned ?? 0);
            setJustLeveledUp(Boolean(data.leveledUp));
            setTotalPoints(data.totalPoints ?? totalPoints);
            setCurrentLevel(data.currentLevel ?? currentLevel);
            setMyRank(data.rank ?? null);
            loadLeaderboard(deviceKey);
          }
        } catch {
          // Progression non enregistrée, tant pis — le jeu reste jouable.
        }
      }
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  function changeLevel(delta: number) {
    const next = Math.min(currentLevel, Math.max(1, selectedLevel + delta));
    if (next === selectedLevel) return;
    setSelectedLevel(next);
    loadGame(next);
  }

  function handleNextLevel() {
    setSelectedLevel(currentLevel);
    loadGame(currentLevel);
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
              Devine la référence ou complète le texte — monte de niveau en niveau.
            </p>
          </div>

          {identified === false && <IdentificationGate onIdentified={startAsIdentifiedPlayer} />}

          {identified && (
            <>
              {progressLoaded && (
                <div className="mb-6 flex items-center justify-between gap-2 rounded-2xl border-2 border-navy/15 bg-white px-3 py-2.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => changeLevel(-1)}
                    disabled={selectedLevel <= 1 || loading}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-navy disabled:opacity-30"
                    aria-label="Niveau précédent"
                  >
                    ←
                  </button>
                  <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Niveau {selectedLevel} / {MAX_LEVEL}
                    </p>
                    <p className="text-sm font-bold text-navy">🏅 {totalPoints} points</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeLevel(1)}
                    disabled={selectedLevel >= currentLevel || loading}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-navy disabled:opacity-30"
                    aria-label="Niveau suivant"
                  >
                    →
                  </button>
                </div>
              )}

              <div className="mb-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaderboard((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                    showLeaderboard
                      ? "border-accent bg-accent/5 text-navy"
                      : "border-navy/15 bg-white text-navy hover:border-accent/40"
                  }`}
                >
                  🏆 Classement
                </button>
              </div>

              {showLeaderboard && (
                <div className="mb-6 card">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <h2 className="text-sm font-bold text-navy">Classement en direct</h2>
                  </div>
                  {leaderboardLoading && leaderboardEntries.length === 0 ? (
                    <p
                      className="flex items-center justify-center text-center text-sm text-gray-400"
                      style={{ height: TICKER_ROW_HEIGHT_PX * TICKER_VISIBLE_ROWS }}
                    >
                      Chargement...
                    </p>
                  ) : (
                    <LiveLeaderboardTicker entries={leaderboardEntries} />
                  )}
                  {/* Hauteur toujours réservée (texte ou non) pour que l'apparition du
                      rang ne décale jamais le reste de la page au rafraîchissement. */}
                  <p className="mt-3 min-h-[2.5rem] text-center text-xs text-gray-400">
                    {myRank && (
                      <>
                        Ton rang actuel : <span className="font-semibold text-accent-dark">#{myRank}</span>{" "}
                        sur {totalPlayers}. Pour apparaître avec ton prénom ici, active &quot;Afficher mon
                        prénom dans le classement&quot;.
                      </>
                    )}
                  </p>
                </div>
              )}

              {loading && <p className="text-center text-gray-400">Chargement...</p>}

              {!loading && error && (
                <div className="card text-center">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                  <button
                    type="button"
                    onClick={() => loadGame(selectedLevel)}
                    className="btn-secondary mt-4"
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {!loading && !error && finished && (
                <div className="card text-center">
                  <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
                    Niveau {selectedLevel} terminé
                  </p>
                  <p className="mt-2 text-4xl font-extrabold text-navy">
                    {score} / {questions.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-accent-dark">+{pointsEarned} points</p>
                  {justLeveledUp && (
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      🎉 Niveau {currentLevel} débloqué !
                    </p>
                  )}
                  {myRank && (
                    <p className="mt-1 text-sm text-gray-500">
                      Tu es #{myRank} sur {totalPlayers}
                    </p>
                  )}
                  <p className="mt-3 text-gray-600">{scoreMessage(score, questions.length)}</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {justLeveledUp ? (
                      <button type="button" onClick={handleNextLevel} className="btn-accent">
                        ⬆️ Niveau suivant
                      </button>
                    ) : (
                      <button type="button" onClick={() => loadGame(selectedLevel)} className="btn-accent">
                        🔁 Rejouer ce niveau
                      </button>
                    )}
                    <Link href="/" className="btn-secondary">
                      🏠 Accueil
                    </Link>
                  </div>
                </div>
              )}

              {!loading && !error && !finished && current && (
                <div className="card">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Niveau {selectedLevel} · Question {index + 1} / {questions.length} · Score : {score}
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

                  {selected !== null && selected !== current.correctAnswer && (
                    <button type="button" onClick={handleNext} className="btn-primary mt-6 w-full">
                      {index + 1 >= questions.length ? "Voir mon score" : "Suivant →"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
