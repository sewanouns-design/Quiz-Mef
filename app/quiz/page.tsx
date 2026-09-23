"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOrCreateDeviceKey,
  getStoredParticipant,
  saveStoredParticipant,
} from "@/lib/participant-storage";
import { isValidEmail } from "@/lib/validation";
import { isValidWhatsappValue } from "@/lib/phone-countries";
import PhoneInput from "@/components/PhoneInput";

export default function QuizIdentificationPage() {
  const router = useRouter();
  const [deviceKey, setDeviceKey] = useState("");
  const [name, setName] = useState("");
  const [parish, setParish] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingQuiz, setCheckingQuiz] = useState(true);
  const [error, setError] = useState("");
  const [phoneInputKey, setPhoneInputKey] = useState("initial");

  useEffect(() => {
    const key = getOrCreateDeviceKey();
    setDeviceKey(key);

    const stored = getStoredParticipant();
    if (stored) {
      setName(stored.name || "");
      setParish(stored.parish || "");
      setEmail(stored.email || "");
      setWhatsapp(stored.whatsapp || "");
      setPhoneInputKey(`stored-${stored.whatsapp || ""}`);
    }

    fetch(`/api/participant?deviceKey=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.participant) {
          setName(data.participant.name || "");
          setParish(data.participant.parish || "");
          setEmail(data.participant.email || "");
          setWhatsapp(data.participant.whatsapp || "");
          setPhoneInputKey(`fetched-${data.participant.whatsapp || ""}`);
        }
      })
      .catch(() => {});

    fetch("/api/quiz/active", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.quiz) {
          setError("Aucun quiz disponible aujourd'hui. Reviens bientôt.");
        }
      })
      .finally(() => setCheckingQuiz(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !parish.trim() || !email.trim()) {
      setError("Le nom, la paroisse et l'email sont requis.");
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
        body: JSON.stringify({ deviceKey, name, parish, email, whatsapp }),
      });

      if (!participantRes.ok) {
        const data = await participantRes.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      saveStoredParticipant({ deviceKey, name, parish, email, whatsapp });

      const quizRes = await fetch("/api/quiz/active", { cache: "no-store" });
      const quizData = await quizRes.json();

      if (!quizData?.quiz) {
        setError("Aucun quiz disponible aujourd'hui. Reviens bientôt.");
        setLoading(false);
        return;
      }

      router.push(`/quiz/${quizData.quiz.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
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
            <label className="label-field" htmlFor="parish">
              Paroisse
            </label>
            <input
              id="parish"
              className="input-field"
              value={parish}
              onChange={(e) => setParish(e.target.value)}
              placeholder="Ex : MEF Zogbadjè"
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

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

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
