"use client";

import { useEffect, useRef, useState } from "react";
import QuestionBuilder, { type EditableQuestion } from "./QuestionBuilder";
import { validateQuizQuestions } from "@/lib/quiz-validation";

interface QuizListItem {
  id: string;
  title: string;
  lesson_date: string;
  is_active: boolean;
  duration_seconds: number | null;
  created_at: string;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s) parts.push(`${s} s`);
  return parts.join(" ") || "0 s";
}

interface StoredQuestion {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  correct_option: number | null;
  correct_text: string | null;
  justification: string | null;
  points: number;
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
    "points": 2
  },
  {
    "type": "mcq",
    "question": "Combien de temps l'arche a-t-elle flotté avant que les eaux ne se retirent ?",
    "options": ["7 jours", "40 jours", "150 jours", "1 an"],
    "correctOption": 2,
    "justification": "Les eaux ont dominé la terre pendant 150 jours.",
    "points": 2
  },
  {
    "type": "short",
    "question": "Quel oiseau Noé a-t-il envoyé en premier pour voir si les eaux avaient baissé ?",
    "correctText": "corbeau",
    "justification": "Noé envoya d'abord un corbeau, puis une colombe.",
    "points": 2
  },
  {
    "type": "true_false",
    "question": "Dieu a promis de ne plus jamais détruire la terre par un déluge.",
    "options": ["Vrai", "Faux"],
    "correctOption": 0,
    "justification": "C'est le sens de l'alliance de l'arc-en-ciel.",
    "points": 2
  },
  {
    "type": "mcq",
    "question": "Combien de membres de la famille de Noé sont entrés dans l'arche ?",
    "options": ["4", "6", "8", "10"],
    "correctOption": 2,
    "justification": "Noé, sa femme, ses trois fils et leurs femmes : 8 personnes.",
    "points": 2
  },
  {
    "type": "mcq",
    "question": "Quel signe Dieu a-t-il donné comme symbole de son alliance ?",
    "options": ["Une colombe", "Un arc-en-ciel", "Une étoile", "Un feu"],
    "correctOption": 1,
    "justification": "L'arc-en-ciel est le signe de l'alliance entre Dieu et la terre.",
    "points": 2
  },
  {
    "type": "true_false",
    "question": "Noé a planté une vigne après le déluge.",
    "options": ["Vrai", "Faux"],
    "correctOption": 0,
    "justification": "Genèse rapporte que Noé devint cultivateur et planta une vigne.",
    "points": 2
  },
  {
    "type": "mcq",
    "question": "Sur quelle montagne l'arche s'est-elle posée ?",
    "options": ["Le Sinaï", "L'Ararat", "Le Carmel", "L'Horeb"],
    "correctOption": 1,
    "justification": "L'arche se posa sur les montagnes d'Ararat.",
    "points": 2
  },
  {
    "type": "mcq",
    "question": "Pourquoi Dieu a-t-il choisi de sauver Noé ?",
    "options": [
      "Il était riche",
      "Il trouva grâce aux yeux de l'Éternel",
      "Il était roi",
      "Il était le plus âgé"
    ],
    "correctOption": 1,
    "justification": "« Noé trouva grâce aux yeux de l'Éternel » (Genèse 6:8).",
    "points": 2
  }
]`;

function toEditableJson(questions: StoredQuestion[]): string {
  const editable: EditableQuestion[] = questions.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    ...(q.options ? { options: q.options } : {}),
    ...(q.correct_option !== null ? { correctOption: q.correct_option } : {}),
    ...(q.correct_text !== null ? { correctText: q.correct_text } : {}),
    ...(q.justification !== null ? { justification: q.justification } : {}),
    points: q.points,
  }));
  return JSON.stringify(editable, null, 2);
}

function tryParseQuestions(json: string): EditableQuestion[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function QuizTab() {
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSecondsPart, setDurationSecondsPart] = useState("");
  const [questionsJson, setQuestionsJson] = useState(EXAMPLE_JSON);
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [regradingQuizId, setRegradingQuizId] = useState<string | null>(null);
  const [regradeMessage, setRegradeMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      try {
        JSON.parse(text);
      } catch {
        setError("Le fichier importé ne contient pas un JSON valide.");
        return;
      }
      setQuestionsJson(text);
    };
    reader.onerror = () => setError("Impossible de lire le fichier.");
    reader.readAsText(file);

    e.target.value = "";
  }

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

  function resetForm() {
    setEditingQuizId(null);
    setTitle("");
    setLessonDate("");
    setIsActive(true);
    setDurationHours("");
    setDurationMinutes("");
    setDurationSecondsPart("");
    setQuestionsJson(EXAMPLE_JSON);
    setEditorMode("visual");
    setError("");
    setSuccess("");
  }

  async function handleEdit(quizId: string) {
    setError("");
    setSuccess("");
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/admin/quiz/${quizId}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors du chargement du quiz.");
      }
      const data = await res.json();
      setEditingQuizId(quizId);
      setTitle(data.quiz.title);
      setLessonDate(data.quiz.lesson_date);
      setIsActive(data.quiz.is_active);
      const totalSeconds: number = data.quiz.duration_seconds ?? 0;
      if (totalSeconds > 0) {
        setDurationHours(String(Math.floor(totalSeconds / 3600)));
        setDurationMinutes(String(Math.floor((totalSeconds % 3600) / 60)));
        setDurationSecondsPart(String(totalSeconds % 60));
      } else {
        setDurationHours("");
        setDurationMinutes("");
        setDurationSecondsPart("");
      }
      setQuestionsJson(toEditableJson(data.questions ?? []));
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function handleSubmitForm(e: React.FormEvent) {
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

    const questionsValidation = validateQuizQuestions(questions);
    if (!questionsValidation.valid) {
      setError(questionsValidation.error ?? "Les questions ne sont pas valides.");
      return;
    }

    const h = Number(durationHours) || 0;
    const m = Number(durationMinutes) || 0;
    const s = Number(durationSecondsPart) || 0;
    if (h < 0 || m < 0 || s < 0) {
      setError("La durée limite ne peut pas être négative.");
      return;
    }
    const totalDurationSeconds = h * 3600 + m * 60 + s;
    const parsedDuration = totalDurationSeconds > 0 ? totalDurationSeconds : null;

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingQuizId);
      const res = await fetch(
        isEdit ? `/api/admin/quiz/${editingQuizId}` : "/api/admin/quiz",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            title,
            lessonDate,
            isActive,
            questions,
            durationSeconds: parsedDuration,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement du quiz.");
      }

      if (isEdit && data.regrade) {
        setSuccess(
          `Quiz modifié avec succès. Recalcul : ${data.regrade.answersUpdated} réponse(s) et ${data.regrade.submissionsUpdated} copie(s) mises à jour.`
        );
      } else {
        setSuccess(isEdit ? "Quiz modifié avec succès." : "Quiz créé avec succès.");
      }
      resetForm();
      loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegrade(quizId: string) {
    setError("");
    setRegradeMessage("");
    setRegradingQuizId(quizId);
    try {
      const res = await fetch(`/api/admin/quiz/${quizId}/regrade`, {
        method: "POST",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du recalcul.");
      }
      setRegradeMessage(
        `Recalcul terminé pour « ${quizzes.find((q) => q.id === quizId)?.title ?? "ce quiz"} » : ${data.answersUpdated} réponse(s) et ${data.submissionsUpdated} copie(s) mises à jour.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setRegradingQuizId(null);
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

  const isEdit = Boolean(editingQuizId);
  const parsedQuestionsForBuilder = tryParseQuestions(questionsJson);

  return (
    <div className="space-y-8">
      <section className="card" ref={formRef}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">
            {isEdit ? "Modifier le quiz" : "Créer un nouveau quiz"}
          </h2>
          {isEdit && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-semibold text-gray-500 hover:underline"
            >
              Annuler la modification
            </button>
          )}
        </div>
        {loadingEdit ? (
          <p className="text-gray-500">Chargement du quiz...</p>
        ) : (
          <form onSubmit={handleSubmitForm} className="space-y-4">
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

            <div>
              <label className="label-field">Durée limite (optionnel)</label>
              <div className="flex items-center gap-2">
                <div>
                  <input
                    type="number"
                    min={0}
                    aria-label="Heures"
                    className="input-field w-20 text-center"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    placeholder="0"
                  />
                  <p className="mt-1 text-center text-[10px] text-gray-400">heures</p>
                </div>
                <span className="pb-4 text-gray-400">:</span>
                <div>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    aria-label="Minutes"
                    className="input-field w-20 text-center"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="0"
                  />
                  <p className="mt-1 text-center text-[10px] text-gray-400">minutes</p>
                </div>
                <span className="pb-4 text-gray-400">:</span>
                <div>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    aria-label="Secondes"
                    className="input-field w-20 text-center"
                    value={durationSecondsPart}
                    onChange={(e) => setDurationSecondsPart(e.target.value)}
                    placeholder="0"
                  />
                  <p className="mt-1 text-center text-[10px] text-gray-400">secondes</p>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Un compte à rebours s&apos;affiche au participant, démarrant dès sa première
                réponse. Le test est soumis automatiquement à l&apos;expiration du temps. Laisser
                à 0 = pas de limite.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {isEdit ? "Actif (quiz du jour)" : "Activer immédiatement (devient le quiz du jour)"}
            </label>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="label-field mb-0">
                  Questions — texte, type, options, bonne réponse, points, justification
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-gray-300 p-0.5">
                    <button
                      type="button"
                      onClick={() => setEditorMode("visual")}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                        editorMode === "visual"
                          ? "bg-navy text-white"
                          : "text-navy hover:bg-navy/10"
                      }`}
                    >
                      ✏️ Édition manuelle
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("json")}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                        editorMode === "json" ? "bg-navy text-white" : "text-navy hover:bg-navy/10"
                      }`}
                    >
                      {"</>"} JSON avancé
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="whitespace-nowrap text-sm font-semibold text-accent-dark hover:underline"
                  >
                    Importer un fichier JSON
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </div>
              </div>

              {editorMode === "visual" ? (
                parsedQuestionsForBuilder ? (
                  <QuestionBuilder
                    questions={parsedQuestionsForBuilder}
                    onChange={(next) => setQuestionsJson(JSON.stringify(next, null, 2))}
                  />
                ) : (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Le JSON actuel n&apos;est pas valide, il ne peut pas être affiché dans
                    l&apos;éditeur visuel. Passe en mode « JSON avancé » pour le corriger, ou
                    importe un nouveau fichier.
                  </div>
                )
              ) : (
                <textarea
                  id="questionsJson"
                  className="input-field min-h-[220px] font-mono text-xs"
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                />
              )}
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            {success && <p className="text-sm font-medium text-green-600">{success}</p>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Enregistrement..."
                  : "Création..."
                : isEdit
                  ? "Enregistrer les modifications"
                  : "Créer le quiz"}
            </button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-bold text-navy">Quiz existants</h2>
        {regradeMessage && (
          <p className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
            {regradeMessage}
          </p>
        )}
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
                  <th className="py-2 pr-4">Durée</th>
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
                    <td className="py-3 pr-4 text-gray-600">
                      {quiz.duration_seconds ? formatDuration(quiz.duration_seconds) : "—"}
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEdit(quiz.id)}
                          className="text-sm font-semibold text-navy hover:underline"
                        >
                          Modifier
                        </button>
                        {!quiz.is_active && (
                          <button
                            onClick={() => handleActivate(quiz.id)}
                            className="text-sm font-semibold text-accent-dark hover:underline"
                          >
                            Activer
                          </button>
                        )}
                        <button
                          onClick={() => handleRegrade(quiz.id)}
                          disabled={regradingQuizId === quiz.id}
                          className="text-sm font-semibold text-gray-500 hover:underline disabled:opacity-50"
                          title="Réévalue toutes les copies déjà soumises avec les bonnes réponses actuelles"
                        >
                          {regradingQuizId === quiz.id ? "Recalcul..." : "🔄 Recalculer les notes"}
                        </button>
                      </div>
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
