"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateDeviceKey,
  getStoredParticipant,
  saveStoredParticipant,
} from "@/lib/participant-storage";
import { isValidEmail } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import PhoneInput from "@/components/PhoneInput";

interface ActiveQuizOption {
  id: string;
  title: string;
  lesson_date: string;
  category: "daily" | "weekly";
}

function QuizIdentificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedQuizId = searchParams.get("quiz");

  const [deviceKey, setDeviceKey] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showInLeaderboard, setShowInLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingQuiz, setCheckingQuiz] = useState(true);
  const [error, setError] = useState("");
  const [phoneInputKey, setPhoneInputKey] = useState("initial");
  const [activeQuizzes, setActiveQuizzes] = useState<ActiveQuizOption[]>([]);
  // Rempli uniquement si plusieurs quiz sont actifs et qu'aucun n'était ciblé
  // directement via ?quiz= : l'identification est déjà enregistrée, il ne
  // reste qu'à choisir lequel commencer.
  const [quizChoices, setQuizChoices] = useState<ActiveQuizOption[] | null>(null);

  useEffect(() => {
    const key = getOrCreateDeviceKey();
    setDeviceKey(key);

    const stored = getStoredParticipant();
    if (stored) {
      setName(stored.name || "");
      setAddress(stored.address || "");
      setEmail(stored.email || "");
      setWhatsapp(stored.whatsapp || "");
      setShowInLeaderboard(Boolean(stored.showInLeaderboard));
      setPhoneInputKey(`stored-${stored.whatsapp || ""}`);
    }

    fetch(`/api/participant?deviceKey=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.participant) {
          setName(data.participant.name || "");
          setAddress(data.participant.address || "");
          setEmail(data.participant.email || "");
          setWhatsapp(data.participant.whatsapp || "");
          setShowInLeaderboard(Boolean(data.participant.show_in_leaderboard));
          setPhoneInputKey(`fetched-${data.participant.whatsapp || ""}`);
        }
      })
      .catch(() => {});

    fetch("/api/quiz/active", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const quizzes: ActiveQuizOption[] = data?.quizzes ?? [];
        setActiveQuizzes(quizzes);
        if (quizzes.length === 0) {
          setError("Aucun quiz disponible aujourd'hui. Reviens bientôt.");
        }
      })
      .finally(() => setCheckingQuiz(false));
  }, []);

  function resolveTargetQuizId(quizzes: ActiveQuizOption[]): string | null {
    if (requestedQuizId && quizzes.some((q) => q.id === requestedQuizId)) {
      return requestedQuizId;
    }
    if (quizzes.length === 1) {
      return quizzes[0].id;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !address.trim() || !email.trim()) {
      setError("Le nom, l'adresse et l'email sont requis.");
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
    try {
      const participantRes = await fetch("/api/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, name, address, email, whatsapp, showInLeaderboard }),
      });

      if (!participantRes.ok) {
        const data = await participantRes.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      saveStoredParticipant({ deviceKey, name, address, email, whatsapp, showInLeaderboard });

      const quizRes = await fetch("/api/quiz/active", { cache: "no-store" });
      const quizData = await quizRes.json();
      const quizzes: ActiveQuizOption[] = quizData?.quizzes ?? [];

      if (quizzes.length === 0) {
        setError("Aucun quiz disponible aujourd'hui. Reviens bientôt.");
        setLoading(false);
        return;
      }

      const targetId = resolveTargetQuizId(quizzes);
      if (targetId) {
        router.push(`/quiz/${targetId}`);
        return;
      }

      // Plusieurs quiz actifs et aucun n'était ciblé précisément : on laisse
      // la personne choisir plutôt que de deviner à sa place.
      setQuizChoices(quizzes);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  if (quizChoices) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
              ⁉️
            </div>
            <h1 className="text-2xl font-bold text-navy">Quel quiz veux-tu faire ?</h1>
            <p className="mt-1 text-gray-600">Plusieurs quiz sont disponibles en ce moment.</p>
          </div>

          <div className="card space-y-3">
            {quizChoices.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                onClick={() => router.push(`/quiz/${quiz.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
              >
                <span className="text-2xl">{quiz.category === "weekly" ? "📅" : "⁉️"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {quiz.category === "weekly" ? "Quiz hebdomadaire" : "Quiz du jour"}
                  </p>
                  <p className="truncate font-semibold text-navy">{quiz.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
            ⁉️
          </div>
          <h1 className="text-2xl font-bold text-navy">Avant de commencer</h1>
          <p className="mt-1 text-gray-600">Dis-nous qui tu es</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label-field" htmlFor="name">
              Nom complet
            </label>
            <input
              id="name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Jean Dossou"
              required
            />
          </div>

          <div>
            <label className="label-field" htmlFor="address">
              Adresse
            </label>
            <input
              id="address"
              className="input-field"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex : Zogbadjè, Cotonou"
              required
            />
          </div>

          <div>
            <label className="label-field" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton.email@exemple.com"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Nécessaire pour recevoir tes résultats par email.
            </p>
          </div>

          <div>
            <label className="label-field" htmlFor="whatsapp">
              Numéro WhatsApp
            </label>
            <PhoneInput
              key={phoneInputKey}
              id="whatsapp"
              initialValue={whatsapp}
              onChange={setWhatsapp}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInLeaderboard}
              onChange={(e) => setShowInLeaderboard(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>
              Afficher mon prénom dans le classement public du quiz (initiale du nom
              seulement, visible par les autres participants).
            </span>
          </label>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {!checkingQuiz && activeQuizzes.length > 1 && !requestedQuizId && (
            <p className="text-xs text-gray-400">
              Plusieurs quiz sont actifs : tu pourras choisir lequel commencer juste après.
            </p>
          )}

          <button
            type="submit"
            className="btn-accent w-full"
            disabled={loading || checkingQuiz}
          >
            {loading ? "Chargement..." : "Commencer"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function QuizIdentificationPage() {
  return (
    <Suspense fallback={null}>
      <QuizIdentificationForm />
    </Suspense>
  );
}
