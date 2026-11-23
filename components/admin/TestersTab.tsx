"use client";

import { useEffect, useState } from "react";

interface Tester {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  testProfile: string | null;
  createdAt: string;
  quizCompleted: number;
  totalQuizAvailable: number;
  totalScore: number;
  totalMaxScore: number;
}

interface Feedback {
  id: string;
  message: string;
  createdAt: string;
  testerName: string;
}

const PROFILE_LABEL: Record<string, string> = {
  assidu: "🏆 Assidu",
  moyen: "📊 Moyen",
  presse: "⚡ Pressé",
  abandon: "🙈 Abandon en cours de route",
};

export default function TestersTab() {
  const [testers, setTesters] = useState<Tester[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/testers", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) throw new Error("Session expirée. Reconnecte-toi.");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Erreur lors du chargement.");
        setTesters(data.testers ?? []);
        setFeedback(data.feedback ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Chargement...</p>;
  if (error) return <p className="text-sm font-medium text-red-600">{error}</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-navy">🧪 Testeurs inscrits</h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
          {testers.length} inscrit{testers.length > 1 ? "s" : ""}
        </span>
      </div>

      {testers.length === 0 ? (
        <p className="text-gray-400">Personne ne s&apos;est encore inscrit via /testeur.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Profil</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Progression</th>
                <th className="px-4 py-3">Score cumulé</th>
                <th className="px-4 py-3">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {testers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-semibold text-navy">{t.name}</td>
                  <td className="px-4 py-3">
                    {t.testProfile ? PROFILE_LABEL[t.testProfile] ?? t.testProfile : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{t.email}</div>
                    {t.whatsapp && <div className="text-xs text-gray-400">{t.whatsapp}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {t.quizCompleted} / {t.totalQuizAvailable} quiz
                  </td>
                  <td className="px-4 py-3">
                    {t.totalScore} / {t.totalMaxScore} pts
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(t.createdAt).toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h3 className="mb-3 text-lg font-bold text-navy">💬 Retours des testeurs</h3>
        {feedback.length === 0 ? (
          <p className="text-gray-400">Aucun retour reçu pour l&apos;instant.</p>
        ) : (
          <div className="space-y-3">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold text-navy">{f.testerName}</span>
                  <span>{new Date(f.createdAt).toLocaleString("fr-FR")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{f.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
