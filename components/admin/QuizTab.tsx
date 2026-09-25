"use client";

import { useEffect, useRef, useState } from "react";
import QuestionBuilder, { type EditableQuestion } from "./QuestionBuilder";
import LessonQuestionsModal from "./LessonQuestionsModal";
import { parseQuizQuestionsInput } from "@/lib/quiz-import-parser";

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

const GENERATION_PROMPT = `Tu es un générateur de quiz bibliques pour le site "Quiz Biblique MEF".
Je vais te fournir le texte d'une leçon (ou une image/photo de la leçon).
Génère un quiz à partir de ce contenu, au format JSON strict ci-dessous.

RÈGLES :
- Réponds UNIQUEMENT avec le tableau JSON, sans texte avant/après, sans balises markdown \`\`\`.
- Génère entre 10 et 20 questions.
- Le total des "points" de toutes les questions doit être égal à 20.
- Un SEUL type de question est autorisé : "mcq" (QCM à 4 options). N'utilise JAMAIS
  les types "true_false", "short", "fill_blank" ou "open" : ils ne sont plus acceptés.
- Chaque question a exactement 4 options dans "options", et une seule bonne réponse
  ("correctOption", index 0 à 3). Varie la position de la bonne réponse d'une question
  à l'autre plutôt que de toujours mettre la même position.
- Deux styles de question "mcq" à alterner dans le quiz :
  1. Question factuelle classique : 4 options plausibles et proches les unes des
     autres (pas de bonne réponse trop évidente par élimination).
  2. Question de type « affirmation à évaluer » (l'équivalent vrai/faux) : NE PROPOSE
     JAMAIS seulement 2 options "Vrai"/"Faux". Formule plutôt 4 propositions complètes,
     chacune combinant un verdict (Vrai/Faux) ET une justification courte, par exemple :
       "Vrai, car le travail existait déjà avant la chute de l'homme."
       "Faux, car Dieu a maudit le sol seulement après la chute de l'homme."
       "Vrai, car Dieu lui-même a dit à l'homme qu'il mangerait à la sueur de son front."
       "Faux, car la leçon ne mentionne jamais la malédiction du travail."
     Une seule des 4 propositions doit être entièrement exacte (bon verdict ET bonne
     justification) ; les trois autres doivent être fausses par le verdict, par la
     justification, ou par les deux — tout en restant plausibles, jamais absurdes.
  Inclue au moins 3 questions du style « affirmation à évaluer » décrit ci-dessus.
- Les questions doivent porter UNIQUEMENT sur des faits présents dans le texte fourni —
  n'invente rien et ne pioche pas dans des connaissances bibliques externes au texte.
- Le champ "justification" est OBLIGATOIRE pour chaque question (ne le laisse jamais
  vide) : il doit citer ou paraphraser précisément le passage de la leçon qui justifie
  la bonne réponse. Un participant qui se trompe la verra affichée à côté de la bonne
  réponse, donc elle doit se suffire à elle-même pour comprendre son erreur sans avoir
  à relire toute la leçon.
- Le champ "question" doit être rédigé en français clair, sans ambiguïté.
- Ne mets JAMAIS le titre du test, la date/période ou une durée limite dans le JSON :
  ces informations sont toujours saisies séparément par la personne qui importe.

FORMAT JSON EXACT À RESPECTER (le tableau de questions, rien d'autre) :
[
  { "type": "mcq", "question": "Texte de la question ?", "options": ["Option A", "Option B", "Option C", "Option D"], "correctOption": 0, "justification": "Citation ou paraphrase du passage de la leçon.", "points": 2 },
  { "type": "mcq", "question": "Le travail est-il présenté comme une malédiction dans la leçon ?", "options": ["Vrai, car le travail existait déjà avant la chute de l'homme.", "Faux, car Dieu a maudit le sol seulement après la chute de l'homme.", "Vrai, car Dieu lui-même a dit à l'homme qu'il mangerait à la sueur de son front.", "Faux, car la leçon ne mentionne jamais la malédiction du travail."], "correctOption": 3, "justification": "Le texte dit au contraire : « le travail n'est pas une malédiction, mais un devoir contractuel. »", "points": 2 }
]

Voici le contenu de la leçon :
[COLLE ICI LE TEXTE DE LA LEÇON, OU DÉCRIS L'IMAGE JOINTE]`;

function CopyPromptButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(GENERATION_PROMPT);
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
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSecondsPart, setDurationSecondsPart] = useState("");
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
  const [lessonQuestionsQuiz, setLessonQuestionsQuiz] = useState<{
    id: string;
    title: string;
  } | null>(null);
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

      setQuestionsJson(JSON.stringify(result.questions, null, 2));
      setEditorMode("visual");
      setSuccess(
        `${result.questions.length} question(s) importée(s) avec succès${
          result.pointsAutoDistributed ? " (points manquants répartis automatiquement)" : ""
        }.`
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

    let rawJson;
    try {
      rawJson = JSON.parse(questionsJson);
    } catch {
      setError("Le JSON des questions est invalide.");
      return;
    }

    if (!title.trim() || !lessonDate) {
      setError("Le titre et la date sont requis.");
      return;
    }

    const importResult = parseQuizQuestionsInput(rawJson);
    if (!importResult.success) {
      setError(importResult.error);
      return;
    }
    const questions = importResult.questions;

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
      loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
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
      setSuccess(`« ${quiz.title} » a été supprimé.`);
      loadQuizzes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
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
        lessonDate: data.quiz.lesson_date as string,
        durationSeconds: data.quiz.duration_seconds as number | null,
        questions,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quiz-${data.quiz.lesson_date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setExportingQuizId(null);
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
              <label className="label-field">Questions</label>

              <details className="mb-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
                <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-navy">
                  📋 Prompt de génération par IA
                </summary>
                <div className="border-t border-gray-200 px-3 py-2">
                  <p className="mb-2 text-xs text-gray-500">
                    Colle ce prompt dans un chat IA avec le texte (ou une photo) de la leçon, puis
                    importe le JSON obtenu ci-dessous.
                  </p>
                  <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 font-mono text-[11px] leading-relaxed text-gray-600">
                    {GENERATION_PROMPT}
                  </pre>
                  <CopyPromptButton />
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
