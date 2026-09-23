"use client";

import { useEffect, useState } from "react";
import ParticipantDetailModal from "./ParticipantDetailModal";

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

  useEffect(() => {
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
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.parish.toLowerCase().includes(q);
  });

  return (
    <section className="card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-navy">
          Participants <span className="text-gray-400">({participants.length})</span>
        </h2>
        <input
          className="input-field sm:max-w-xs"
          placeholder="Rechercher par nom ou paroisse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
    </section>
  );
}
