"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getOrCreateDeviceKey,
  getStoredParticipant,
  saveStoredParticipant,
} from "@/lib/participant-storage";
import { isValidEmail, isValidName } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import PhoneInput from "@/components/PhoneInput";
import SiteHeader from "@/components/SiteHeader";

interface TesteurQuiz {
  id: string;
  title: string;
  subtitle: string | null;
  category: "daily" | "weekly" | "quarterly";
  done: boolean;
  score: number | null;
  maxScore: number | null;
}

const CATEGORY_LABEL: Record<TesteurQuiz["category"], string> = {
  daily: "Quiz quotidiens",
  weekly: "Quiz hebdomadaires",
  quarterly: "Examen trimestriel",
};

export default function TesteurPage() {
  const [deviceKey, setDeviceKey] = useState("");
  const [isTester, setIsTester] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phoneInputKey, setPhoneInputKey] = useState("initial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quizzes, setQuizzes] = useState<TesteurQuiz[] | null>(null);

  function loadQuizzes(key: string) {
    fetch(`/api/testeur/quizzes?deviceKey=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setIsTester(false);
          return;
        }
        const data = await res.json();
        setQuizzes(data.quizzes ?? []);
        setIsTester(true);
      })
      .catch(() => setIsTester(false));
  }

  useEffect(() => {
    const key = getOrCreateDeviceKey();
    setDeviceKey(key);

    const stored = getStoredParticipant();
    if (stored) {
      setName(stored.name || "");
      setAddress(stored.address || "");
      setEmail(stored.email || "");
      setWhatsapp(stored.whatsapp || "");
      setPhoneInputKey(`stored-${stored.whatsapp || ""}`);
    }

    loadQuizzes(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isValidName(name)) {
      setError("Merci d'indiquer ton vrai nom (lettres uniquement, pas de chiffres ni de symboles).");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Le format de l'email n'est pas valide.");
      return;
    }
    if (!isValidWhatsappValue(whatsapp)) {
      setError("Le format du numéro WhatsApp n'est pas valide.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, name, address, email, whatsapp, isTest: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }
      const { participant } = await res.json().catch(() => ({ participant: null }));
      saveStoredParticipant({
        deviceKey,
        name: participant?.name ?? name,
        address: participant?.address ?? address,
        email: participant?.email ?? email,
        whatsapp: participant?.whatsapp ?? whatsapp,
      });
      loadQuizzes(deviceKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  if (isTester === null) {
    return (
      <>
        <SiteHeader />
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
          <p className="text-gray-400">Chargement...</p>
        </main>
      </>
    );
  }

  if (isTester && quizzes) {
    const byCategory: Record<string, TesteurQuiz[]> = {};
    for (const q of quizzes) {
      byCategory[q.category] = byCategory[q.category] ?? [];
      byCategory[q.category].push(q);
    }

    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <div className="mb-6 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-800">
            🧪 Mode testeur — ces quiz n'apparaissent pas pour les autres participants et tes
            résultats ne comptent jamais dans les vrais classements.
          </div>
          <h1 className="mb-6 text-2xl font-bold text-navy">Tous les quiz à tester</h1>

          {(["daily", "weekly", "quarterly"] as const).map((category) =>
            byCategory[category]?.length ? (
              <section key={category} className="mb-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                  {CATEGORY_LABEL[category]}
                </h2>
                <div className="space-y-2">
                  {byCategory[category].map((q) => (
                    <Link
                      key={q.id}
                      href={`/quiz/${q.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-accent hover:bg-accent/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy">{q.title}</p>
                        {q.subtitle && (
                          <p className="truncate text-xs text-gray-400">{q.subtitle}</p>
                        )}
                      </div>
                      {q.done ? (
                        <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                          ✓ {q.score}/{q.maxScore}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">
                          À faire
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null
          )}

          {quizzes.length === 0 && (
            <p className="text-gray-400">Aucun quiz disponible pour le moment.</p>
          )}
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
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl shadow-lg">
              🧪
            </div>
            <h1 className="text-2xl font-bold text-navy">Espace testeur</h1>
            <p className="mt-1 text-gray-600">
              Identifie-toi pour accéder à tous les quiz du trimestre à tester.
            </p>
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

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button type="submit" className="btn-accent w-full" disabled={loading}>
              {loading ? "Chargement..." : "Entrer en mode testeur"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
