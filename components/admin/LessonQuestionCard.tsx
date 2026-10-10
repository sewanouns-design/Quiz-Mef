"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

export interface LessonQuestionReply {
  id: string;
  sender: "admin" | "participant";
  message: string;
  created_at: string;
}

export interface LessonQuestionEntry {
  id: string;
  question_text: string;
  created_at: string;
  participant: { id: string; name: string; address: string | null } | null;
  quiz?: { id: string; title: string } | null;
  replies: LessonQuestionReply[];
}

export default function LessonQuestionCard({
  question,
  showQuizTitle = false,
  onParticipantClick,
  onReplied,
}: {
  question: LessonQuestionEntry;
  showQuizTitle?: boolean;
  onParticipantClick?: (participantId: string) => void;
  onReplied: (questionId: string, reply: LessonQuestionReply) => void;
}) {
  const toast = useToast();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const hasAdminReply = question.replies.some((r) => r.sender === "admin");

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/lesson-questions/${question.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi de la réponse.");
      }
      onReplied(question.id, data.reply);
      setReplyText("");
      toast.success("Réponse envoyée.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        {question.participant ? (
          <button
            type="button"
            onClick={() => onParticipantClick?.(question.participant!.id)}
            className="font-semibold text-navy hover:underline"
          >
            {question.participant.name}
          </button>
        ) : (
          <span className="font-semibold text-navy">Participant inconnu</span>
        )}
        <span className="text-xs text-gray-400">
          {new Date(question.created_at).toLocaleString("fr-FR")}
        </span>
      </div>
      {showQuizTitle && question.quiz && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-dark">
          {question.quiz.title}
        </p>
      )}
      <p className="text-sm text-gray-700">{question.question_text}</p>

      {question.replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {question.replies.map((r) => (
            <li
              key={r.id}
              className={`rounded-lg p-2.5 text-sm ${
                r.sender === "admin" ? "bg-navy/5 text-navy" : "bg-gray-50 text-gray-700"
              }`}
            >
              <p className="mb-0.5 text-xs font-semibold text-gray-500">
                {r.sender === "admin" ? "Un admin" : question.participant?.name ?? "Participant"} ·{" "}
                {new Date(r.created_at).toLocaleString("fr-FR")}
              </p>
              {r.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className="input-field flex-1 text-sm"
          placeholder={hasAdminReply ? "Ajouter une précision..." : "Répondre à cette question..."}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendReply();
          }}
        />
        <button
          type="button"
          onClick={handleSendReply}
          disabled={sending || !replyText.trim()}
          className="btn-secondary shrink-0 px-3 py-2 text-sm"
        >
          {sending ? "..." : hasAdminReply ? "Ajouter" : "Répondre"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </li>
  );
}
