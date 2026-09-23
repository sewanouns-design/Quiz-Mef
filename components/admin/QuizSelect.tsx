"use client";

import { useEffect, useState } from "react";

interface QuizOption {
  id: string;
  title: string;
  lesson_date: string;
}

export default function QuizSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (quizId: string) => void;
}) {
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/quizzes", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des quiz.");
        }
        const list: QuizOption[] = data.quizzes ?? [];
        setQuizzes(list);
        if (!value && list.length > 0) {
          onChange(list[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-gray-500">Chargement des quiz...</p>;
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-600">{error}</p>
        {error.includes("Session expirée") && (
          <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
            Se reconnecter →
          </a>
        )}
      </div>
    );
  }
  if (quizzes.length === 0) return <p className="text-gray-500">Aucun quiz créé pour le moment.</p>;

  return (
    <select
      className="input-field sm:max-w-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {quizzes.map((quiz) => (
        <option key={quiz.id} value={quiz.id}>
          {quiz.title} — {new Date(quiz.lesson_date).toLocaleDateString("fr-FR")}
        </option>
      ))}
    </select>
  );
}
