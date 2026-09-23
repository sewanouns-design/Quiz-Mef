"use client";

import { useEffect, useState } from "react";

interface QuizListItem {
  id: string;
  title: string;
  lesson_date: string;
  is_active: boolean;
  created_at: string;
}

const EXAMPLE_JSON = `[
  {
    "type": "mcq",
    "question": "Qui a construit l'arche ?",
    "options": ["Moïse", "Noé", "Abraham", "David"],
    "correctOption": 1,
    "justification": "Selon la leçon, Dieu a demandé à Noé de construire l'arche.",
    "points": 2
  },
  {
    "type": "true_false",
    "question": "L'arche a flotté pendant 40 jours et 40 nuits.",
    "options": ["Vrai", "Faux"],
    "correctOption": 0,
    "justification": "La pluie est tombée 40 jours et 40 nuits.",
    "points": 1
  }
]`;

export default function QuizTab() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [title, setTitle] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [questionsJson, setQuestionsJson] = useState(EXAMPLE_JSON);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function loadQuizzes() {
    setLoadingList(true);
    fetch("/api/admin/quizzes", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setQuizzes(data.quizzes ?? []))
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    let questions;
    try {
      questions = JSON.parse(questionsJson);
    } catch {
      setError("Le JSON des questions est invalide.");
      return;
    }

    if (!title.trim() || !lessonDate) {
      setError("Le titre et la date sont requis.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ title, lessonDate, isActive, questions }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la création du quiz.");
      }

      setSuccess("Quiz créé avec succès.");
      setTitle("");
      setLessonDate("");
      setQuestionsJson(EXAMPLE_JSON);
      loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(quizId: string) {
    setError("");
    try {
      const res = await fetch(`/api/admin/quiz/${quizId}/activate`, {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'activation.");
      }
      loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="card">
        <h2 className="mb-4 text-lg font-bold text-navy">Créer un nouveau quiz</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="title">
                Titre
              </label>
              <input
                id="title"
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Leçon du 23 septembre"
              />
            </div>
            <div>
              <label className="label-field" htmlFor="lessonDate">
                Date de la leçon
              </label>
              <input
                id="lessonDate"
                type="date"
                className="input-field"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-navy">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Activer immédiatement (devient le quiz du jour)
          </label>

          <div>
            <label className="label-field" htmlFor="questionsJson">
              Questions (JSON)
            </label>
            <textarea
              id="questionsJson"
              className="input-field min-h-[220px] font-mono text-xs"
              value={questionsJson}
              onChange={(e) => setQuestionsJson(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {success && <p className="text-sm font-medium text-green-600">{success}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Création..." : "Créer le quiz"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold text-navy">Quiz existants</h2>
        {loadingList ? (
          <p className="text-gray-500">Chargement...</p>
        ) : quizzes.length === 0 ? (
          <p className="text-gray-500">Aucun quiz créé pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 pr-4">Titre</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-navy">{quiz.title}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {new Date(quiz.lesson_date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3 pr-4">
                      {quiz.is_active ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {!quiz.is_active && (
                        <button
                          onClick={() => handleActivate(quiz.id)}
                          className="text-sm font-semibold text-gold-dark hover:underline"
                        >
                          Activer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
