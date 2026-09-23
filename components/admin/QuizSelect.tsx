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

  useEffect(() => {
    fetch("/api/admin/quizzes", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list: QuizOption[] = data.quizzes ?? [];
        setQuizzes(list);
        if (!value && list.length > 0) {
          onChange(list[0].id);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-gray-500">Chargement des quiz...</p>;
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
