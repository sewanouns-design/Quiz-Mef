"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

interface SuggestionEntry {
  id: string;
  message: string;
  acknowledged: boolean;
  admin_response: string | null;
  responded_at: string | null;
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
  const toast = useToast();
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
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
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  async function patchSuggestion(id: string, body: { acknowledged?: boolean; adminResponse?: string }) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la mise à jour.");
      }
      setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, ...data.suggestion } : s)));
      toast.success(body.adminResponse !== undefined ? "Réponse enregistrée." : "Mise à jour effectuée.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-navy">💡 Suggestions des participants</h2>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : error && suggestions.length === 0 ? (
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

              {s.admin_response && (
                <div className="mt-3 rounded-lg bg-navy/5 p-2.5 text-sm text-navy">
                  <p className="mb-0.5 text-xs font-semibold text-gray-500">Ta réponse</p>
                  {s.admin_response}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm font-medium text-navy">
                  <input
                    type="checkbox"
                    checked={s.acknowledged}
                    disabled={savingId === s.id}
                    onChange={(e) => patchSuggestion(s.id, { acknowledged: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Prise en compte
                </label>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  className="input-field flex-1 text-sm"
                  placeholder={s.admin_response ? "Modifier la réponse..." : "Répondre à cette suggestion..."}
                  value={replyDrafts[s.id] ?? ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (replyDrafts[s.id] ?? "").trim()) {
                      patchSuggestion(s.id, { adminResponse: replyDrafts[s.id] });
                      setReplyDrafts((prev) => ({ ...prev, [s.id]: "" }));
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={savingId === s.id || !(replyDrafts[s.id] ?? "").trim()}
                  onClick={() => {
                    patchSuggestion(s.id, { adminResponse: replyDrafts[s.id] });
                    setReplyDrafts((prev) => ({ ...prev, [s.id]: "" }));
                  }}
                  className="btn-secondary shrink-0 px-3 py-2 text-sm"
                >
                  {savingId === s.id ? "..." : "Répondre"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
