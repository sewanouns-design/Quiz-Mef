"use client";

import { useEffect, useState } from "react";

interface SuggestionEntry {
  id: string;
  message: string;
  created_at: string;
  participant: {
    id: string;
    name: string;
    email: string | null;
    whatsapp: string | null;
    address: string | null;
  } | null;
}

export default function SuggestionsTab() {
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/suggestions", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les suggestions.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des suggestions.");
        }
        setSuggestions(data.suggestions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-navy">💡 Suggestions des participants</h2>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : error ? (
        <div>
          <p className="text-sm font-medium text-red-600">{error}</p>
          {error.includes("Session expirée") && (
            <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
              Se reconnecter →
            </a>
          )}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Aucune suggestion pour le moment.
        </p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-navy">
                  {s.participant?.name ?? "Participant inconnu"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
              {s.participant && (
                <p className="mb-2 text-xs text-gray-500">
                  {[s.participant.address, s.participant.email, s.participant.whatsapp]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              )}
              <p className="text-sm text-gray-700">{s.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
