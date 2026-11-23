"use client";

import { useState } from "react";
import Link from "next/link";
import { getStoredParticipant } from "@/lib/participant-storage";
import SiteHeader from "@/components/SiteHeader";

export default function TesteurRetourPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) {
      setError("Identifie-toi d'abord sur /testeur avant de laisser un retour.");
      return;
    }
    if (!message.trim()) {
      setError("Merci d'écrire un message avant d'envoyer.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi.");
      }
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl shadow-lg">
              🧪
            </div>
            <h1 className="text-2xl font-bold text-navy">Ton retour de test</h1>
            <p className="mt-1 text-gray-600">
              Un bug, un bouton qui ne marche pas, un score bizarre, une question mal affichée...
              dis-nous tout, même les petits détails.
            </p>
          </div>

          {sent ? (
            <div className="card space-y-4 text-center">
              <p className="font-semibold text-green-700">✅ Merci, ton retour a bien été envoyé !</p>
              <button type="button" className="btn-accent w-full" onClick={() => setSent(false)}>
                Envoyer un autre retour
              </button>
              <Link href="/testeur" className="block text-sm font-semibold text-navy hover:underline">
                ← Retourner à la liste des quiz
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card space-y-4">
              <textarea
                className="input-field min-h-[160px]"
                placeholder="Décris ce que tu as remarqué (quel quiz, quel écran, ce qui s'est passé)..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <button type="submit" className="btn-accent w-full" disabled={loading}>
                {loading ? "Envoi..." : "Envoyer mon retour"}
              </button>
              <Link href="/testeur" className="block text-center text-sm font-semibold text-navy hover:underline">
                ← Retourner à la liste des quiz
              </Link>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
