"use client";

import { useEffect, useState } from "react";

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
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/participants", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setParticipants(data.participants ?? []))
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
                  <td className="py-3 pr-4 font-medium text-navy">{p.name}</td>
                  <td className="py-3 pr-4 text-gray-600">{p.parish}</td>
                  <td className="py-3 pr-4">
                    {p.email ? (
                      <a href={`mailto:${p.email}`} className="text-gold-dark hover:underline">
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
    </section>
  );
}
