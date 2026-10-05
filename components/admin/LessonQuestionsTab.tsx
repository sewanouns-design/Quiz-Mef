"use client";

import { useEffect, useMemo, useState } from "react";
import ParticipantDetailModal from "./ParticipantDetailModal";
import LessonQuestionCard, { LessonQuestionEntry, LessonQuestionReply } from "./LessonQuestionCard";

type Filter = "all" | "unanswered" | "answered";

export default function LessonQuestionsTab() {
  const [questions, setQuestions] = useState<LessonQuestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin/lesson-questions", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les questions.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des questions.");
        }
        setQuestions(data.questions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  function handleReplied(questionId: string, reply: LessonQuestionReply) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, replies: [...q.replies, reply] } : q))
    );
  }

  const filtered = useMemo(() => {
    if (filter === "all") return questions;
    return questions.filter((q) => {
      const answered = q.replies.some((r) => r.sender === "admin");
      return filter === "answered" ? answered : !answered;
    });
  }, [questions, filter]);

  const unansweredCount = questions.filter((q) => !q.replies.some((r) => r.sender === "admin")).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy">
          💬 Questions sur la leçon
          {unansweredCount > 0 && (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {unansweredCount} en attente
            </span>
          )}
        </h2>
        <div className="flex gap-1">
          {(
            [
              ["all", "Toutes"],
              ["unanswered", "En attente"],
              ["answered", "Répondues"],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === id ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Aucune question {filter === "unanswered" ? "en attente" : filter === "answered" ? "répondue" : "posée"} pour le moment.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((q) => (
            <LessonQuestionCard
              key={q.id}
              question={q}
              showQuizTitle
              onParticipantClick={setSelectedParticipantId}
              onReplied={handleReplied}
            />
          ))}
        </ul>
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
