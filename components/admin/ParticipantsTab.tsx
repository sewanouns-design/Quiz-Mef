"use client";

import { useEffect, useState } from "react";
import ParticipantDetailModal from "./ParticipantDetailModal";
import MergeParticipantsModal from "./MergeParticipantsModal";

interface Participant {
  id: string;
  name: string;
  parish: string;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
}

function toWhatsappLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

export default function ParticipantsTab() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  function loadParticipants() {
    setLoading(true);
    fetch("/api/admin/participants", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les participants.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des participants.");
        }
        setParticipants(data.participants ?? []);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadParticipants();
  }, []);

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.parish.toLowerCase().includes(q);
  });

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))
    );
  }

  async function handleDeleteSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    const confirmed = window.confirm(
      `Supprimer définitivement ${count} participant(s) sélectionné(s), ainsi que toutes leurs soumissions et questions posées ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la suppression.");
      }
      setSelectedIds(new Set());
      loadParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-navy">
          Participants <span className="text-gray-400">({participants.length})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size >= 2 && (
            <button
              type="button"
              onClick={() => setShowMerge(true)}
              className="rounded-lg border-2 border-navy px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              🔀 Fusionner ({selectedIds.size})
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Suppression..." : `Supprimer la sélection (${selectedIds.size})`}
            </button>
          )}
          <input
            className="input-field sm:max-w-xs"
            placeholder="Rechercher par nom ou paroisse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-600">{error}</p>
          {error.includes("Session expirée") && (
            <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
              Se reconnecter →
            </a>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">Aucun participant trouvé.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300"
                    aria-label="Tout sélectionner"
                  />
                </th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Paroisse</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">WhatsApp</th>
                <th className="py-2 pr-4">Inscription</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label={`Sélectionner ${p.name}`}
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium text-navy">
                    <button
                      type="button"
                      onClick={() => setSelectedParticipantId(p.id)}
                      className="hover:underline"
                    >
                      {p.name}
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{p.parish}</td>
                  <td className="py-3 pr-4">
                    {p.email ? (
                      <a href={`mailto:${p.email}`} className="text-accent-dark hover:underline">
                        {p.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {p.whatsapp ? (
                      <a
                        href={toWhatsappLink(p.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        {p.whatsapp}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedParticipantId && (
        <ParticipantDetailModal
          participantId={selectedParticipantId}
          onClose={() => setSelectedParticipantId(null)}
        />
      )}

      {showMerge && (
        <MergeParticipantsModal
          candidates={participants.filter((p) => selectedIds.has(p.id))}
          onClose={() => setShowMerge(false)}
          onMerged={() => {
            setShowMerge(false);
            setSelectedIds(new Set());
            loadParticipants();
          }}
        />
      )}
    </section>
  );
}
