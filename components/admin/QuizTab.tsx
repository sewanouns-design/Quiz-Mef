"use client";

import { useEffect, useRef, useState } from "react";
import QuestionBuilder, { type EditableQuestion } from "./QuestionBuilder";
import LessonQuestionsModal from "./LessonQuestionsModal";
import { parseQuizQuestionsInput, type QuizImportMetadata } from "@/lib/quiz-import-parser";
import { GENERATION_PROMPTS } from "@/lib/quiz-generation-prompts";
import { useToast } from "@/components/Toast";

interface QuizListItem {
  id: string;
  title: string;
  subtitle: string | null;
  is_active: boolean;
  duration_seconds: number | null;
  expires_at: string | null;
  category: "daily" | "weekly" | "quarterly";
  created_at: string;
}

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Convertit un ISO stocké en base vers la valeur attendue par un input datetime-local (heure locale, sans fuseau). */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    "type": "mcq",
    "question": "L'arche a-t-elle flotté pendant 40 jours et 40 nuits ?",
    "options": [
      "Vrai, car la pluie est tombée 40 jours et 40 nuits.",
      "Faux, car la pluie n'a duré que 7 jours.",
      "Vrai, car les eaux ont mis 40 jours à se retirer.",
      "Faux, car la leçon ne donne aucune durée."
    ],
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
    "type": "mcq",
    "question": "Quel oiseau Noé a-t-il envoyé en premier pour voir si les eaux avaient baissé ?",
    "options": ["Un corbeau", "Une colombe", "Un aigle", "Un moineau"],
    "correctOption": 0,
    "justification": "Noé envoya d'abord un corbeau, puis une colombe.",
    "points": 2
  },
  {
    "type": "mcq",
    "question": "Dieu a-t-il promis de ne plus jamais détruire la terre par un déluge ?",
    "options": [
      "Vrai, c'est le sens de l'alliance de l'arc-en-ciel.",
      "Faux, Dieu n'a fait aucune promesse à ce sujet.",
      "Vrai, mais seulement pour la durée de la vie de Noé.",
      "Faux, l'alliance de l'arc-en-ciel concerne autre chose."
    ],
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
    "type": "mcq",
    "question": "Noé a-t-il planté une vigne après le déluge ?",
    "options": [
      "Vrai, Genèse rapporte que Noé devint cultivateur et planta une vigne.",
      "Faux, Noé n'a jamais cultivé la terre.",
      "Vrai, mais c'est l'un de ses fils qui l'a plantée.",
      "Faux, il a planté un olivier, pas une vigne."
    ],
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



function CopyPromptButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // presse-papier indisponible, tant pis
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-light"
    >
      {copied ? "✓ Copié" : "📋 Copier le prompt"}
    </button>
  );
}

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
  const toast = useToast();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSecondsPart, setDurationSecondsPart] = useState("");
  const [quizMode, setQuizMode] = useState<"overview" | "sequential">("overview");
  const [category, setCategory] = useState<"daily" | "weekly" | "quarterly">("daily");
  const [questionsJson, setQuestionsJson] = useState("[]");
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [regradingQuizId, setRegradingQuizId] = useState<string | null>(null);
  const [regradeMessage, setRegradeMessage] = useState("");
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [deactivatingQuizId, setDeactivatingQuizId] = useState<string | null>(null);
  const [exportingQuizId, setExportingQuizId] = useState<string | null>(null);
  const [manualAutomationRunning, setManualAutomationRunning] = useState(false);
  const [lessonQuestionsQuiz, setLessonQuestionsQuiz] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  function applyImportedMetadata(metadata?: QuizImportMetadata): boolean {
    if (!metadata) return false;
    if (metadata.title) setTitle(metadata.title);
    if (metadata.subtitle) setSubtitle(metadata.subtitle);
    if (metadata.category) setCategory(metadata.category);
    if (metadata.expiresAt) setExpiresAt(toDatetimeLocalValue(metadata.expiresAt));
    if (metadata.durationSeconds) {
      const total = metadata.durationSeconds;
      setDurationHours(String(Math.floor(total / 3600)));
      setDurationMinutes(String(Math.floor((total % 3600) / 60)));
      setDurationSecondsPart(String(total % 60));
    }
    return Boolean(
      metadata.title ||
        metadata.subtitle ||
        metadata.category ||
        metadata.durationSeconds ||
        metadata.expiresAt
    );
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      let parsedJson;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        setError("Le fichier importé ne contient pas un JSON valide.");
        return;
      }

      const result = parseQuizQuestionsInput(parsedJson);
      if (!result.success) {
        setError(result.error);
        return;
      }

      const metadataApplied = applyImportedMetadata(result.metadata);
      setQuestionsJson(JSON.stringify(result.questions, null, 2));
      setEditorMode("visual");
      setSuccess(
        `${result.questions.length} question(s) importée(s) avec succès${
          result.pointsAutoDistributed ? " (points manquants répartis automatiquement)" : ""
        }${metadataApplied ? ". Paramètres du quiz remplis automatiquement, y compris l’échéance." : "."}`
      );
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

  async function handleManualAutomation() {
    setManualAutomationRunning(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/automation/run", {
        method: "POST",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de lancer l’automatisation.");
      const message = data.message || "La génération a été lancée en arrière-plan.";
      setSuccess(message);
      toast.success("Génération lancée.");
      // L’agent travaille en arrière-plan : on rafraîchit la liste après un court délai,
      // sans prétendre que les quiz sont déjà terminés à l’instant du clic.
      window.setTimeout(loadQuizzes, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setManualAutomationRunning(false);
    }
  }

  useEffect(() => {
    loadQuizzes();
  }, []);

  function resetForm() {
    setEditingQuizId(null);
    setTitle("");
    setSubtitle("");
    setExpiresAt("");
    setIsActive(true);
    setDurationHours("");
    setDurationMinutes("");
    setDurationSecondsPart("");
    setQuizMode("overview");
    setCategory("daily");
    setQuestionsJson("[]");
    setEditorMode("visual");
    setError("");
    setSuccess("");
  }

  function handleLoadExample() {
    setQuestionsJson(EXAMPLE_JSON);
    setEditorMode("visual");
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
      setSubtitle(data.quiz.subtitle ?? "");
      setExpiresAt(data.quiz.expires_at ? toDatetimeLocalValue(data.quiz.expires_at) : "");
      setIsActive(data.quiz.is_active);
      setQuizMode(data.quiz.quiz_mode === "sequential" ? "sequential" : "overview");
      setCategory(
        data.quiz.category === "quarterly"
          ? "quarterly"
          : data.quiz.category === "weekly"
            ? "weekly"
            : "daily"
      );
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

    let rawJson;
    try {
      rawJson = JSON.parse(questionsJson);
    } catch {
      setError("Le JSON des questions est invalide.");
      return;
    }

    const importResult = parseQuizQuestionsInput(rawJson);
    if (!importResult.success) {
      setError(importResult.error);
      return;
    }
    const questions = importResult.questions;
    const importedMetadata = importResult.metadata;
    applyImportedMetadata(importedMetadata);
    const effectiveTitle = importedMetadata?.title?.trim() || title.trim();
    const effectiveSubtitle = importedMetadata?.subtitle ?? subtitle;
    const effectiveCategory = importedMetadata?.category ?? category;
    const effectiveExpiresAt = importedMetadata?.expiresAt
      ? new Date(importedMetadata.expiresAt).toISOString()
      : expiresAt
        ? new Date(expiresAt).toISOString()
        : null;

    const h = Number(durationHours) || 0;
    const m = Number(durationMinutes) || 0;
    const s = Number(durationSecondsPart) || 0;
    if (h < 0 || m < 0 || s < 0) {
      setError("La durée limite ne peut pas être négative.");
      return;
    }
    const totalDurationSeconds = h * 3600 + m * 60 + s;
    const parsedDuration =
      importedMetadata?.durationSeconds ?? (totalDurationSeconds > 0 ? totalDurationSeconds : null);
    if (!effectiveTitle) {
      setError("Le titre est requis (saisis-le ou importe un JSON contenant metadata.title).");
      return;
    }

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
            title: effectiveTitle,
            subtitle: effectiveSubtitle,
            isActive,
            questions,
            durationSeconds: parsedDuration,
            expiresAt: effectiveExpiresAt,
            quizMode,
            category: effectiveCategory,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement du quiz.");
      }

      const successMessage =
        isEdit && data.regrade
          ? `Quiz modifié avec succès. Recalcul : ${data.regrade.answersUpdated} réponse(s) et ${data.regrade.submissionsUpdated} copie(s) mises à jour.`
          : isEdit
            ? "Quiz modifié avec succès."
            : "Quiz créé avec succès.";
      setSuccess(successMessage);
      toast.success(successMessage);
      resetForm();
      loadQuizzes();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
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
      const message = `Recalcul terminé pour « ${quizzes.find((q) => q.id === quizId)?.title ?? "ce quiz"} » : ${data.answersUpdated} réponse(s) et ${data.submissionsUpdated} copie(s) mises à jour.`;
      setRegradeMessage(message);
      toast.success(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
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
      toast.success("Quiz activé.");
      loadQuizzes();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    }
  }

  async function handleDeactivate(quizId: string) {
    setError("");
    setDeactivatingQuizId(quizId);
    try {
      const res = await fetch(`/api/admin/quiz/${quizId}/deactivate`, {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la désactivation.");
      }
      toast.success("Quiz désactivé.");
      loadQuizzes();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setDeactivatingQuizId(null);
    }
  }

  async function handleDelete(quiz: QuizListItem) {
    const confirmed = window.confirm(
      `Supprimer définitivement « ${quiz.title} » ainsi que toutes les copies et réponses déjà soumises pour ce quiz ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingQuizId(quiz.id);
    try {
      const res = await fetch(`/api/admin/quiz/${quiz.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la suppression.");
      }
      if (editingQuizId === quiz.id) resetForm();
      const message = `« ${quiz.title} » a été supprimé.`;
      setSuccess(message);
      toast.success(message);
      loadQuizzes();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingQuizId(null);
    }
  }

  async function handleExport(quiz: QuizListItem) {
    setError("");
    setExportingQuizId(quiz.id);
    try {
      const res = await fetch(`/api/admin/quiz/${quiz.id}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'export.");
      }
      const data = await res.json();
      const questions: EditableQuestion[] = (data.questions as StoredQuestion[]).map((q) => ({
        type: q.type,
        question: q.question,
        ...(q.options ? { options: q.options } : {}),
        ...(q.correct_option !== null ? { correctOption: q.correct_option } : {}),
        ...(q.correct_text !== null ? { correctText: q.correct_text } : {}),
        ...(q.justification !== null ? { justification: q.justification } : {}),
        points: q.points,
      }));

      const exportPayload = {
        title: data.quiz.title as string,
        subtitle: data.quiz.subtitle as string | null,
        durationSeconds: data.quiz.duration_seconds as number | null,
        questions,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const slug = (data.quiz.title as string)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      link.download = `quiz-${slug || data.quiz.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setExportingQuizId(null);
    }
  }

  const isEdit = Boolean(editingQuizId);
  const generationPrompt = GENERATION_PROMPTS[category];
  const parsedQuestionsForBuilder = tryParseQuestions(questionsJson);

  return (
    <div className="space-y-8">
      <section className="card border-accent-light bg-accent-light/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">Automatisation des quiz</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              Si le passage horaire n’a pas fonctionné, lance ici une vérification immédiate.
              Le système recherche les quiz manquants, évite les doublons et travaille en arrière-plan.
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualAutomation}
            disabled={manualAutomationRunning}
            className="btn-primary shrink-0"
          >
            {manualAutomationRunning ? "Lancement..." : "Générer les quiz maintenant"}
          </button>
        </div>
      </section>
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
                <label className="label-field" htmlFor="subtitle">
                  Sous-titre (optionnel)
                </label>
                <input
                  id="subtitle"
                  className="input-field"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ex : Genèse 6-9 : Noé et le déluge"
                />
              </div>
            </div>

            <div>
              <label className="label-field" htmlFor="expiresAt">
                Échéance (optionnel)
              </label>
              <input
                id="expiresAt"
                type="datetime-local"
                className="input-field sm:max-w-xs"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                Passé ce moment, le quiz n&apos;est plus proposé aux participants (page d&apos;accueil,
                sélecteur de quiz) même s&apos;il reste marqué actif — pas besoin de penser à le
                désactiver. Laisser vide = pas d&apos;échéance.
              </p>
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
                Un compte à rebours s&apos;affiche au participant, démarrant au clic sur
                « Commencer le test » (jamais avant). Le test est soumis automatiquement à
                l&apos;expiration du temps. Laisser à 0 = pas de limite.
              </p>
            </div>

            <div>
              <label className="label-field">Mode d&apos;affichage des questions</label>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setQuizMode("overview")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    quizMode === "overview" ? "bg-navy text-white" : "text-gray-500"
                  }`}
                >
                  Aperçu global
                </button>
                <button
                  type="button"
                  onClick={() => setQuizMode("sequential")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    quizMode === "sequential" ? "bg-navy text-white" : "text-gray-500"
                  }`}
                >
                  Séquentiel
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {quizMode === "overview"
                  ? "Toutes les questions apparaissent d'un coup au clic sur « Commencer le test »."
                  : "Une seule question à la fois, avec boutons Précédent/Suivant — impossible de voir la suite à l'avance."}
              </p>
            </div>

            <div>
              <label className="label-field">Catégorie</label>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setCategory("daily")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    category === "daily" ? "bg-navy text-white" : "text-gray-500"
                  }`}
                >
                  Quiz du jour
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("weekly")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    category === "weekly" ? "bg-navy text-white" : "text-gray-500"
                  }`}
                >
                  Quiz hebdomadaire
                </button>
                <button
                  type="button"
                  onClick={() => setCategory("quarterly")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    category === "quarterly" ? "bg-navy text-white" : "text-gray-500"
                  }`}
                >
                  Quiz trimestriel
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {category === "quarterly"
                  ? "Examen général du trimestre, avec 20 questions et 15 minutes."
                  : category === "weekly"
                  ? "Mis en avant par une bannière dédiée, très visible, sur la page d'accueil."
                  : "Affiché normalement sur la page d'accueil."}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {isEdit ? "Actif" : "Activer immédiatement"}
            </label>
            <p className="-mt-2 text-xs text-gray-400">
              Plusieurs quiz peuvent rester actifs en même temps (ex. quiz du jour + quiz
              hebdomadaire) : activer celui-ci ne désactive pas les autres.
            </p>

            <div>
              <label className="label-field">Questions</label>

              <details className="mb-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-navy">
                  📋 Prompt de génération par IA — {category === "daily" ? "quotidien" : category === "weekly" ? "hebdomadaire" : "trimestriel"}
                </summary>
                <div className="border-t border-gray-200 px-3 py-2">
                  <p className="mb-2 text-xs text-gray-500">
                    Colle ce prompt dans un chat IA avec le contenu autorisé, puis importe le JSON
                    obtenu. Le prompt affiché correspond à la catégorie sélectionnée.
                  </p>
                  <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 font-mono text-[11px] leading-relaxed text-gray-600">
                    {generationPrompt}
                  </pre>
                  <CopyPromptButton prompt={generationPrompt} />
                </div>
              </details>

              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setEditorMode("visual")}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      editorMode === "visual"
                        ? "bg-navy text-white"
                        : "text-navy hover:bg-navy/10"
                    }`}
                  >
                    Visuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("json")}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      editorMode === "json" ? "bg-navy text-white" : "text-navy hover:bg-navy/10"
                    }`}
                  >
                    JSON
                  </button>
                </div>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="whitespace-nowrap text-xs font-semibold text-accent-dark hover:underline"
                >
                  Importer un fichier
                </button>
                {!isEdit && questionsJson.trim() === "[]" && (
                  <>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={handleLoadExample}
                      className="whitespace-nowrap text-xs font-semibold text-gray-500 hover:underline"
                    >
                      Exemple
                    </button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>

              {editorMode === "visual" ? (
                parsedQuestionsForBuilder ? (
                  <QuestionBuilder
                    questions={parsedQuestionsForBuilder}
                    onChange={(next) => setQuestionsJson(JSON.stringify(next, null, 2))}
                    optionCount={category === "quarterly" ? 5 : 4}
                  />
                ) : (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    Le JSON actuel n&apos;est pas valide, il ne peut pas être affiché dans
                    l&apos;éditeur visuel. Passe en mode « JSON » pour le corriger, ou importe un
                    nouveau fichier.
                  </div>
                )
              ) : (
                <textarea
                  id="questionsJson"
                  className="input-field min-h-[160px] font-mono text-xs"
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
                  <th className="py-2 pr-4">Catégorie</th>
                  <th className="py-2 pr-4">Échéance</th>
                  <th className="py-2 pr-4">Durée</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-navy">
                      {quiz.title}
                      {quiz.subtitle && (
                        <p className="mt-0.5 text-xs font-normal text-gray-400">{quiz.subtitle}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {quiz.category === "quarterly" ? (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                          🏆 Trimestriel
                        </span>
                      ) : quiz.category === "weekly" ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          📅 Hebdo
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Jour
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {quiz.expires_at ? formatExpiry(quiz.expires_at) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {quiz.duration_seconds ? formatDuration(quiz.duration_seconds) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {(() => {
                        const expired = quiz.expires_at && new Date(quiz.expires_at) <= new Date();
                        if (quiz.is_active && expired) {
                          return (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Expiré
                            </span>
                          );
                        }
                        return quiz.is_active ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            Actif
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            Inactif
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEdit(quiz.id)}
                          className="text-sm font-semibold text-navy hover:underline"
                        >
                          Modifier
                        </button>
                        {quiz.is_active ? (
                          <button
                            onClick={() => handleDeactivate(quiz.id)}
                            disabled={deactivatingQuizId === quiz.id}
                            className="text-sm font-semibold text-gray-500 hover:underline disabled:opacity-50"
                            title="Retire ce quiz du statut « quiz du jour » sans en activer un autre"
                          >
                            {deactivatingQuizId === quiz.id ? "Désactivation..." : "Désactiver"}
                          </button>
                        ) : (
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
                        <button
                          onClick={() => handleExport(quiz)}
                          disabled={exportingQuizId === quiz.id}
                          className="text-sm font-semibold text-gray-500 hover:underline disabled:opacity-50"
                          title="Télécharge les questions de ce quiz au format JSON"
                        >
                          {exportingQuizId === quiz.id ? "Export..." : "⬇️ Exporter"}
                        </button>
                        <button
                          onClick={() => setLessonQuestionsQuiz({ id: quiz.id, title: quiz.title })}
                          className="text-sm font-semibold text-gray-500 hover:underline"
                          title="Voir les questions posées par les participants sur cette leçon"
                        >
                          💬 Questions
                        </button>
                        <button
                          onClick={() => handleDelete(quiz)}
                          disabled={deletingQuizId === quiz.id}
                          className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingQuizId === quiz.id ? "Suppression..." : "Supprimer"}
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

      {lessonQuestionsQuiz && (
        <LessonQuestionsModal
          quizId={lessonQuestionsQuiz.id}
          quizTitle={lessonQuestionsQuiz.title}
          onClose={() => setLessonQuestionsQuiz(null)}
        />
      )}
    </div>
  );
}
