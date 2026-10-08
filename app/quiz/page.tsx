"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateDeviceKey,
  getStoredParticipant,
  saveStoredParticipant,
} from "@/lib/participant-storage";
import { isValidEmail, isValidName } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import PhoneInput from "@/components/PhoneInput";
import SiteHeader from "@/components/SiteHeader";

interface ActiveQuizOption {
  id: string;
  title: string;
  subtitle: string | null;
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
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingQuiz, setCheckingQuiz] = useState(true);
  const [error, setError] = useState("");
  const [phoneInputKey, setPhoneInputKey] = useState("initial");
  const [showMagicLinkForm, setShowMagicLinkForm] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState("");
  // Quiz déjà déterminé (lien direct ?quiz=, ou un seul quiz du jour actif) :
  // on passe directement à l'identification pour celui-ci.
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  // Rempli uniquement si plusieurs quiz du jour sont actifs et qu'aucun
  // n'était ciblé directement via ?quiz= : on demande lequel commencer
  // AVANT l'identification, pas après.
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

        // Un lien direct (pop-up du quiz hebdo) passe toujours en priorité,
        // même si ce quiz n'est pas de catégorie "daily".
        const requested = requestedQuizId
          ? quizzes.find((q) => q.id === requestedQuizId)
          : undefined;
        if (requested) {
          setSelectedQuizId(requested.id);
          return;
        }

        // Sinon, seuls les quiz du jour sont proposés : le quiz hebdo n'est
        // jamais accessible par ce flux normal, uniquement par son lien
        // direct depuis la page d'accueil.
        const daily = quizzes.filter((q) => q.category !== "weekly");
        if (daily.length === 0) {
          setError("Aucun quiz disponible aujourd'hui. Reviens bientôt.");
        } else if (daily.length === 1) {
          setSelectedQuizId(daily[0].id);
        } else {
          // Plusieurs quiz du jour actifs : on demande lequel commencer
          // tout de suite, avant même de montrer le formulaire.
          setQuizChoices(daily);
        }
      })
      .catch(() => setError("Erreur lors du chargement des quiz disponibles."))
      .finally(() => setCheckingQuiz(false));
  }, [requestedQuizId]);

  function handleChooseQuiz(quizId: string) {
    setSelectedQuizId(quizId);
    setQuizChoices(null);
  }

  async function handleRequestMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(magicLinkEmail)) {
      setMagicLinkMessage("Le format de l'email n'est pas valide.");
      return;
    }
    setMagicLinkSending(true);
    setMagicLinkMessage("");
    try {
      const res = await fetch("/api/participant/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: magicLinkEmail }),
      });
      const data = await res.json().catch(() => ({}));
      setMagicLinkMessage(
        data.message || data.error || "Si cette adresse est associée à un profil, un lien vient d'être envoyé."
      );
    } catch {
      setMagicLinkMessage("Une erreur est survenue, réessaie plus tard.");
    } finally {
      setMagicLinkSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedQuizId) return;

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

      // Le serveur peut avoir rattaché cet appareil à une fiche existante
      // (même email déjà connu) et normalisé l'email : on repart de la
      // version canonique renvoyée plutôt que de la saisie brute.
      const { participant } = await participantRes.json().catch(() => ({ participant: null }));
      saveStoredParticipant({
        deviceKey,
        name: participant?.name ?? name,
        address: participant?.address ?? address,
        email: participant?.email ?? email,
        whatsapp: participant?.whatsapp ?? whatsapp,
        showInLeaderboard: participant?.show_in_leaderboard ?? showInLeaderboard,
      });

      router.push(`/quiz/${selectedQuizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  if (checkingQuiz) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
          <p className="text-gray-400">Chargement...</p>
        </main>
      </>
    );
  }

  if (quizChoices) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
              ⁉️
            </div>
            <h1 className="text-2xl font-bold text-navy">Quel quiz veux-tu faire ?</h1>
            <p className="mt-1 text-gray-600">Plusieurs quiz du jour sont disponibles en ce moment.</p>
          </div>

          <div className="card space-y-3">
            {quizChoices.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                onClick={() => handleChooseQuiz(quiz.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
              >
                <span className="text-2xl">⁉️</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Quiz du jour
                  </p>
                  <p className="truncate font-semibold text-navy">{quiz.title}</p>
                  {quiz.subtitle && (
                    <p className="truncate text-xs text-gray-400">{quiz.subtitle}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
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
              Nécessaire pour les rappels et pour retrouver ton profil sur un autre appareil.
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

          <button
            type="submit"
            className="btn-accent w-full"
            disabled={loading || !selectedQuizId}
          >
            {loading ? "Chargement..." : "Commencer"}
          </button>
        </form>

        <div className="mt-4 text-center">
          {!showMagicLinkForm ? (
            <button
              type="button"
              onClick={() => setShowMagicLinkForm(true)}
              className="text-sm font-semibold text-navy hover:underline"
            >
              Déjà identifié sur un autre appareil ?
            </button>
          ) : (
            <form onSubmit={handleRequestMagicLink} className="card space-y-3 text-left">
              <p className="text-sm font-semibold text-navy">
                Reçois un lien par email pour retrouver ton profil ici, sans tout ressaisir.
              </p>
              <input
                type="email"
                className="input-field"
                placeholder="ton.email@exemple.com"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                required
              />
              {magicLinkMessage && (
                <p className="text-sm font-medium text-gray-600">{magicLinkMessage}</p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={magicLinkSending}>
                {magicLinkSending ? "Envoi..." : "Envoyer le lien"}
              </button>
            </form>
          )}
        </div>
      </div>
      </main>
    </>
  );
}

export default function QuizIdentificationPage() {
  return (
    <Suspense fallback={null}>
      <QuizIdentificationForm />
    </Suspense>
  );
}
