"use client";

import { useEffect, useState } from "react";

interface ParticipantDetail {
  id: string;
  name: string;
  address: string;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
}

interface SubmissionEntry {
  id: string;
  score: number;
  max_score: number;
  submitted_at: string;
  quiz: { id: string; title: string; lesson_date: string } | null;
}

function toWhatsappLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}

export default function ParticipantDetailModal({
  participantId,
  onClose,
}: {
  participantId: string;
  onClose: () => void;
}) {
  const [participant, setParticipant] = useState<ParticipantDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/participants/${participantId}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement.");
        }
        setParticipant(data.participant);
        setSubmissions(data.submissions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, [participantId]);

  const totalQuizzes = submissions.length;
  const totalScore = submissions.reduce((sum, s) => sum + s.score, 0);
  const totalMax = submissions.reduce((sum, s) => sum + s.max_score, 0);
  const average = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(0) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <p className="text-gray-500">Chargement...</p>
        ) : error ? (
          <div>
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button onClick={onClose} className="btn-secondary mt-4">
              Fermer
            </button>
          </div>
        ) : participant ? (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy">{participant.name}</h2>
                <p className="text-sm text-gray-500">{participant.address}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              {participant.email ? (
                <a
                  href={`mailto:${participant.email}`}
                  className="rounded-lg border border-accent/30 px-3 py-1.5 text-accent-dark hover:bg-accent/10"
                >
                  ✉️ {participant.email}
                </a>
              ) : (
                <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">
                  Pas d&apos;email
                </span>
              )}
              {participant.whatsapp ? (
                <a
                  href={toWhatsappLink(participant.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-green-300 px-3 py-1.5 text-green-700 hover:bg-green-50"
                >
                  💬 {participant.whatsapp}
                </a>
              ) : (
                <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">
                  Pas de WhatsApp
                </span>
              )}
            </div>

            {totalQuizzes > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                <div>
                  <p className="text-lg font-extrabold text-navy">{totalQuizzes}</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Quiz passés
                  </p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-navy">
                    {totalScore}/{totalMax}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Total points
                  </p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-navy">{average}%</p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Moyenne
                  </p>
                </div>
              </div>
            )}

            <h3 className="mb-2 text-sm font-semibold text-navy">Historique des quiz</h3>
            {submissions.length === 0 ? (
              <p className="text-sm text-gray-500">
                Ce participant n&apos;a encore soumis aucun quiz.
              </p>
            ) : (
              <ul className="space-y-2">
                {submissions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy">
                        {s.quiz?.title ?? "Quiz supprimé"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.quiz?.lesson_date
                          ? new Date(s.quiz.lesson_date).toLocaleDateString("fr-FR")
                          : ""}{" "}
                        · soumis le {new Date(s.submitted_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-navy">
                      {s.score} / {s.max_score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
