"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getStoredParticipant } from "@/lib/participant-storage";

interface SuggestionEntry {
  id: string;
  message: string;
  acknowledged: boolean;
  adminResponse: string | null;
  createdAt: string;
}

export default function ContactPage() {
  const [identified, setIdentified] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pastMessages, setPastMessages] = useState<SuggestionEntry[]>([]);

  useEffect(() => {
    const stored = getStoredParticipant();
    setIdentified(Boolean(stored?.deviceKey && stored?.name));
    if (stored?.deviceKey) {
      fetch(`/api/participant/suggestions?deviceKey=${encodeURIComponent(stored.deviceKey)}`, {
        cache: "no-store",
      })
        .then((res) => res.json())
        .then((data) => {
          const entries = (data.suggestions ?? []).map(
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
          setPastMessages(entries);
        })
        .catch(() => {});
    }
  }, []);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    const deviceKey = getStoredParticipant()?.deviceKey;
    if (!deviceKey) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ deviceKey, message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi.");
      }
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
              ✉️
            </div>
            <h1 className="text-2xl font-bold text-navy">Contact</h1>
            <p className="mt-1 text-gray-600">Une question, une idée ? Écris-nous.</p>
          </div>

          {identified === false && (
            <div className="card text-center">
              <p className="text-sm text-gray-600">
                Pour nous écrire, identifie-toi d&apos;abord en répondant à un quiz — ça ne prend
                qu&apos;un instant.
              </p>
              <Link href="/quiz" className="btn-accent mt-4 inline-flex">
                Commencer un quiz
              </Link>
            </div>
          )}

          {identified && (
            <div className="card">
              {pastMessages.length > 0 && (
                <ul className="mb-4 space-y-3">
                  {pastMessages.map((s) => (
                    <li key={s.id} className="rounded-xl bg-navy/5 p-3">
                      <p className="text-sm text-gray-700">{s.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {s.acknowledged ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            ✅ Prise en compte
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                            ⏳ En attente
                          </span>
                        )}
                      </div>
                      {s.adminResponse && (
                        <div className="mt-2 rounded-lg bg-white p-2.5 text-sm text-navy">
                          <p className="mb-0.5 text-xs font-semibold text-gray-500">
                            Réponse de l&apos;équipe
                          </p>
                          {s.adminResponse}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {sent ? (
                <p className="text-sm font-medium text-green-700">
                  Merci, ton message a bien été envoyé !
                </p>
              ) : (
                <>
                  <textarea
                    className="input-field min-h-[100px] w-full"
                    placeholder="Ton message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  {error && <p className="mt-1 text-sm font-medium text-red-600">{error}</p>}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className="btn-accent mt-3"
                  >
                    {sending ? "Envoi..." : "Envoyer"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
