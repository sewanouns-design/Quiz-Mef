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

interface LevelUpToast {
  id: string;
  displayName: string;
  level: number;
  rank: number | null;
}

const QUESTIONS_PER_GAME = 10;
const ACTIVITY_POLL_MS = 4000;
const TOAST_LIFETIME_MS = 3200;
const AUTO_ADVANCE_DELAY_MS = 900;
// Nombre de bulles que la colonne flottante peut tenir en même temps,
// empilées du plus récent (en bas) au plus ancien (en haut) : au-delà, les
// plus anciennes sont retirées pour laisser la place aux nouvelles plutôt
// que de s'accumuler indéfiniment.
const MAX_STACKED_TOASTS = 5;
const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function scoreMessage(score: number, total: number): string {
  const percent = (score / total) * 100;
  if (percent === 100) return "Parfait ! Tu connais vraiment bien tes versets. 🏆";
  if (percent >= 70) return "Très bien joué ! 👏";
  if (percent >= 40) return "Pas mal, continue à t'entraîner ! 💪";
  return "Rejoue pour mieux les retenir. 📖";
}

/**
 * Notifications flottantes "niveau débloqué" façon likes de live
 * (TikTok/Facebook) : empilées du même côté que la carte de jeu, chacune
 * monte en flottant puis s'efface — jamais un panneau à part qui prend de
 * la place en permanence. Seuls les passages de niveau déclenchent une
 * bulle (pas chaque point gagné), et seulement pour les joueurs ayant
 * accepté d'apparaître dans les classements (même règle de confidentialité
 * que partout ailleurs sur le site).
 */
function LevelUpToasts({ toasts }: { toasts: LevelUpToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-20 z-50 flex flex-col items-end gap-2 sm:right-[calc(50%-13rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-verse-toast flex items-center gap-2 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
        >
          <span>{(t.rank && RANK_MEDALS[t.rank]) || "🎉"}</span>
          <span>
            {t.rank && <>#{t.rank} · </>}
            {t.displayName} vient d&apos;atteindre le niveau {t.level} !
          </span>
        </div>
      ))}
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
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
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

interface VerseGameAvailability {
  open: boolean;
  enabled: boolean;
  scheduleEnabled: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VerseGamePage() {
  const [availability, setAvailability] = useState<VerseGameAvailability | null>(null);
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

  const [toasts, setToasts] = useState<LevelUpToast[]>([]);
  const activitySinceRef = useRef<string>(new Date().toISOString());
  // Réponses de la partie en cours (verset + correct/incorrect), envoyées à
  // la fin du niveau pour alimenter les vraies statistiques de difficulté
  // par verset (voir lib/verse-level.ts et l'onglet admin correspondant).
  const answersRef = useRef<{ verseId: string; correct: boolean }[]>([]);
  // Jeton anti-triche émis par /api/verse-game/questions à chaque partie,
  // requis par /api/verse-game/level-complete pour prouver que ces
  // questions ont bien été chargées avant la validation du niveau.
  const sessionTokenRef = useRef<string>("");

  function loadLeaderboardStats(key: string) {
    fetch(`/api/verse-game/leaderboard?deviceKey=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { totalPlayers: number; myRank: number | null } | null) => {
        if (!data) return;
        setTotalPlayers(data.totalPlayers ?? 0);
        setMyRank(data.myRank);
      })
      .catch(() => {});
  }

  function pollActivity() {
    fetch(`/api/verse-game/activity?since=${encodeURIComponent(activitySinceRef.current)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            events: { id: string; displayName: string; level: number; rank: number | null }[];
            latest: string;
          } | null
        ) => {
        if (!data) return;
        activitySinceRef.current = data.latest;
        if (data.events.length === 0) return;
        setToasts((prev) =>
          [
            ...prev,
            ...data.events.map((e) => ({
              id: e.id,
              displayName: e.displayName,
              level: e.level,
              rank: e.rank,
            })),
          ].slice(-MAX_STACKED_TOASTS)
        );
        for (const e of data.events) {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== e.id));
          }, TOAST_LIFETIME_MS);
        }
      })
      .catch(() => {});
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
    answersRef.current = [];
    fetch(`/api/verse-game/questions?count=${QUESTIONS_PER_GAME}&level=${level}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement du jeu.");
        }
        setQuestions(data.questions ?? []);
        sessionTokenRef.current = data.sessionToken ?? "";
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
    loadLeaderboardStats(key);
    loadProgress(key).then((level) => loadGame(level));
  }

  useEffect(() => {
    fetch("/api/verse-game/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { open: true, enabled: true, scheduleEnabled: false, opensAt: null, closesAt: null }))
      .then((data: VerseGameAvailability) => {
        setAvailability(data);
        if (!data.open) {
          setLoading(false);
          return;
        }
        const stored = getStoredParticipant();
        if (stored?.name && stored?.deviceKey) {
          startAsIdentifiedPlayer();
        } else {
          setIdentified(false);
          setLoading(false);
        }
      })
      .catch(() => {
        setAvailability({ open: true, enabled: true, scheduleEnabled: false, opensAt: null, closesAt: null });
        const stored = getStoredParticipant();
        if (stored?.name && stored?.deviceKey) {
          startAsIdentifiedPlayer();
        } else {
          setIdentified(false);
          setLoading(false);
        }
      });
    return () => {
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sonde en continu les niveaux débloqués par tout le monde, pour faire
  // apparaître les notifications flottantes — indépendant du score propre
  // au joueur, tant que la page est ouverte.
  useEffect(() => {
    if (!identified) return;
    const poll = setInterval(pollActivity, ACTIVITY_POLL_MS);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified]);

  const current = questions[index];

  // Bonne réponse : avance automatiquement après un court délai (le temps de
  // voir la case passer au vert), pas besoin de cliquer sur "Suivant".
  // Mauvaise réponse : on reste sur la question, la bonne réponse s'affiche
  // en vert, et c'est à la personne de cliquer sur "Suivant" pour continuer.
  function handleAnswer(option: string) {
    if (!current || selected) return;
    setSelected(option);
    const correct = option === current.correctAnswer;
    answersRef.current.push({ verseId: current.verseId, correct });
    if (correct) {
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
            body: JSON.stringify({
              deviceKey,
              level: selectedLevel,
              score,
              total: questions.length,
              answers: answersRef.current,
              sessionToken: sessionTokenRef.current,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setPointsEarned(data.pointsEarned ?? 0);
            setJustLeveledUp(Boolean(data.leveledUp));
            setTotalPoints(data.totalPoints ?? totalPoints);
            setCurrentLevel(data.currentLevel ?? currentLevel);
            setMyRank(data.rank ?? null);
            loadLeaderboardStats(deviceKey);
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
      <LevelUpToasts toasts={toasts} />
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

          {availability === null && <p className="text-center text-gray-400">Chargement...</p>}

          {availability && !availability.open && (
            <div className="card text-center">
              <p className="text-3xl">⏳</p>
              {!availability.enabled ? (
                <p className="mt-3 font-medium text-gray-600">
                  Le jeu « Trouve le verset » est actuellement désactivé. Reviens plus tard !
                </p>
              ) : (
                <p className="mt-3 font-medium text-gray-600">
                  Le jeu est accessible uniquement sur un créneau précis.
                  {availability.opensAt && Date.now() < new Date(availability.opensAt).getTime() && (
                    <> Ouverture le {formatDateTime(availability.opensAt)}.</>
                  )}
                  {availability.closesAt && Date.now() > new Date(availability.closesAt).getTime() && (
                    <> Le créneau s&apos;est terminé le {formatDateTime(availability.closesAt)}.</>
                  )}
                </p>
              )}
            </div>
          )}

          {availability?.open && identified === false && (
            <IdentificationGate onIdentified={startAsIdentifiedPlayer} />
          )}

          {availability?.open && identified && (
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
                    <p className="text-sm font-bold text-navy">
                      🏅 {totalPoints} points
                      {myRank && <span className="text-gray-400"> · #{myRank}/{totalPlayers}</span>}
                    </p>
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
