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
import { generateVerseGameImage } from "@/lib/generate-verse-game-image";

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
  pointsEarned: number | null;
  leveledUp: boolean;
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

// Dernier résultat de partie, persisté pour qu'une actualisation de page
// juste après avoir terminé un niveau (avant d'avoir cliqué "Niveau
// suivant") restaure exactement cet écran au lieu de repartir dans une
// nouvelle partie — la personne doit continuer à voir "100%, niveau
// débloqué" tant qu'elle n'a pas explicitement rejoué ou changé de niveau.
interface StoredLevelResult {
  level: number;
  score: number;
  total: number;
  pointsEarned: number;
  leveledUp: boolean;
  currentLevelAfter: number;
  rank: number | null;
  savedAt: number;
}

const LAST_RESULT_TTL_MS = 10 * 60 * 1000;

function lastResultStorageKey(deviceKey: string): string {
  return `verse_game_last_result_v1_${deviceKey}`;
}

function saveLastResult(deviceKey: string, result: StoredLevelResult) {
  try {
    window.localStorage.setItem(lastResultStorageKey(deviceKey), JSON.stringify(result));
  } catch {
    // Stockage indisponible : tant pis, juste pas de restauration après actualisation.
  }
}

function readLastResult(deviceKey: string): StoredLevelResult | null {
  try {
    const raw = window.localStorage.getItem(lastResultStorageKey(deviceKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLevelResult;
    if (Date.now() - parsed.savedAt > LAST_RESULT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearLastResult(deviceKey: string) {
  try {
    window.localStorage.removeItem(lastResultStorageKey(deviceKey));
  } catch {
    // Rien à faire.
  }
}

function scoreMessage(score: number, total: number): string {
  const percent = (score / total) * 100;
  if (percent === 100) return "Parfait ! Tu connais vraiment bien tes versets. 🏆";
  if (percent >= 70) return "Très bien joué ! 👏";
  if (percent >= 40) return "Pas mal, continue à t'entraîner ! 💪";
  return "Rejoue pour mieux les retenir. 📖";
}

/**
 * Notifications flottantes façon likes de live (TikTok/Facebook) : empilées
 * du même côté que la carte de jeu, chacune monte en flottant puis s'efface
 * — jamais un panneau à part qui prend de la place en permanence. Toute
 * partie terminée avec des points gagnés déclenche une bulle (texte +
 * icône différents si elle fait aussi passer au niveau suivant).
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
          <span>{t.leveledUp ? (t.rank && RANK_MEDALS[t.rank]) || "🎉" : "✨"}</span>
          <span>
            {t.rank && <>#{t.rank} · </>}
            {t.leveledUp ? (
              <>
                {t.displayName} vient d&apos;atteindre le niveau {t.level} !
              </>
            ) : (
              <>
                {t.displayName} vient de gagner {t.pointsEarned} points !
              </>
            )}
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
        body: JSON.stringify({ deviceKey, name, email, whatsapp, showInLeaderboard: true }),
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
        showInLeaderboard: true,
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
  // Total de la partie affiché sur l'écran de fin — distinct de
  // questions.length pour pouvoir restaurer ce même écran après une
  // actualisation de page sans avoir à recharger les questions (voir
  // restoreLastResult).
  const [resultTotal, setResultTotal] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
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
            events: {
              id: string;
              displayName: string;
              level: number;
              rank: number | null;
              pointsEarned: number | null;
              leveledUp: boolean;
            }[];
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
              pointsEarned: e.pointsEarned,
              leveledUp: e.leveledUp,
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
    if (deviceKey) clearLastResult(deviceKey);
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
    loadProgress(key).then((level) => {
      // Si la personne vient d'actualiser la page juste après avoir
      // terminé un niveau (avant de cliquer "Niveau suivant"), on restaure
      // exactement cet écran de résultat au lieu de relancer une partie —
      // seulement si le niveau serveur confirme bien que la soumission a
      // réussi (sinon le résultat stocké est obsolète/invalide).
      const stored = readLastResult(key);
      if (stored && stored.currentLevelAfter === level) {
        setSelectedLevel(stored.level);
        setScore(stored.score);
        setResultTotal(stored.total);
        setPointsEarned(stored.pointsEarned);
        setJustLeveledUp(stored.leveledUp);
        setMyRank(stored.rank);
        setFinished(true);
        setLoading(false);
        return;
      }
      loadGame(level);
    });
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

  // Envoie (ou renvoie, si échec réseau) le résultat du niveau au serveur.
  // Avant tout, on efface l'ancien résultat affiché (points/passage de
  // niveau d'une partie précédente) : sans ça, un échec d'enregistrement
  // laissait les chiffres de la partie PRÉCÉDENTE affichés sur l'écran de
  // fin de la partie ACTUELLE, donnant l'impression trompeuse que rien ne
  // s'était passé ou que le niveau suivant n'était jamais débloqué.
  async function submitLevelComplete() {
    if (!deviceKey) return;
    const total = questions.length;
    setResultTotal(total);
    setPointsEarned(0);
    setJustLeveledUp(false);
    setSyncError("");
    setSyncing(true);
    try {
      const res = await fetch("/api/verse-game/level-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          deviceKey,
          level: selectedLevel,
          score,
          total,
          answers: answersRef.current,
          sessionToken: sessionTokenRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement de ta progression.");
      }
      const leveledUp = Boolean(data.leveledUp);
      setPointsEarned(data.pointsEarned ?? 0);
      setJustLeveledUp(leveledUp);
      setTotalPoints(data.totalPoints ?? totalPoints);
      setCurrentLevel(data.currentLevel ?? currentLevel);
      setMyRank(data.rank ?? null);
      loadLeaderboardStats(deviceKey);
      // Persisté pour survivre à une actualisation de page avant que la
      // personne ait cliqué "Niveau suivant" — voir startAsIdentifiedPlayer.
      saveLastResult(deviceKey, {
        level: selectedLevel,
        score,
        total,
        pointsEarned: data.pointsEarned ?? 0,
        leveledUp,
        currentLevelAfter: data.currentLevel ?? currentLevel,
        rank: data.rank ?? null,
        savedAt: Date.now(),
      });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleNext() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      await submitLevelComplete();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  async function handleShare() {
    setShareError("");
    setSharing(true);

    const participantName = getStoredParticipant()?.name || "Un joueur";
    const message = justLeveledUp
      ? `Je viens de débloquer le niveau ${currentLevel} à « Trouve le verset » ! 📖 Viens tester tes connaissances bibliques toi aussi sur quiz.mefzogbadje.org`
      : `Je joue à « Trouve le verset » et j'en suis au niveau ${selectedLevel} ! 📖 Viens tester tes connaissances bibliques toi aussi sur quiz.mefzogbadje.org`;

    try {
      const blob = await generateVerseGameImage({
        participantName,
        level: justLeveledUp ? currentLevel : selectedLevel,
        leveledUp: justLeveledUp,
        totalPoints,
        rank: myRank,
      });
      const file = new File([blob], "trouve-le-verset.png", { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Trouve le verset", text: message });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trouve-le-verset.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setShareError("Impossible de générer l'image, partage du score en texte seulement.");
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    } finally {
      setSharing(false);
    }
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
                    {score} / {resultTotal}
                  </p>

                  {syncing && <p className="mt-2 text-sm text-gray-400">Enregistrement...</p>}

                  {!syncing && syncError && (
                    <div className="mt-2 rounded-xl bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-600">{syncError}</p>
                      <button
                        type="button"
                        onClick={submitLevelComplete}
                        className="mt-2 text-sm font-semibold text-red-700 underline"
                      >
                        Réessayer l&apos;enregistrement
                      </button>
                    </div>
                  )}

                  {!syncing && !syncError && (
                    <>
                      <p className="mt-1 text-sm font-semibold text-accent-dark">+{pointsEarned} points</p>
                      {justLeveledUp && (
                        <p className="mt-1 text-sm font-semibold text-green-700">
                          🎉 Niveau {currentLevel} débloqué !
                        </p>
                      )}
                      {!justLeveledUp && score < resultTotal && (
                        <p className="mt-1 text-sm font-semibold text-red-600">
                          ❌ Échec — il faut 100% pour passer au niveau suivant. Reprends ce niveau !
                        </p>
                      )}
                      {!justLeveledUp && score === resultTotal && (
                        <p className="mt-1 text-sm font-medium text-gray-500">
                          Tu maîtrises déjà ce niveau — rejoue-le pour gagner encore des points, ou passe au
                          niveau que tu n&apos;as pas encore débloqué.
                        </p>
                      )}
                      {myRank && (
                        <p className="mt-1 text-sm text-gray-500">
                          Tu es #{myRank} sur {totalPlayers}
                        </p>
                      )}
                    </>
                  )}

                  <p className="mt-3 text-gray-600">{scoreMessage(score, resultTotal)}</p>
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
                  <div className="mt-3 flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={sharing}
                      className="btn-accent"
                    >
                      {sharing ? "Préparation de l'image..." : "📤 Partager pour inviter des amis"}
                    </button>
                    {shareError && <p className="text-xs font-medium text-red-500">{shareError}</p>}
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
