"use client";

export interface EditableQuestion {
  type: string;
  question: string;
  options?: string[];
  correctOption?: number;
  correctText?: string;
  justification?: string;
  points: number;
}

const TYPE_LABELS: Record<string, string> = {
  mcq: "QCM (choix multiple)",
  true_false: "Vrai / Faux",
  short: "Réponse courte",
  fill_blank: "Texte à trous",
  open: "Question ouverte (correction manuelle)",
};

const TYPE_OPTIONS = Object.entries(TYPE_LABELS);

export function emptyQuestion(): EditableQuestion {
  return { type: "mcq", question: "", options: ["", ""], correctOption: 0, points: 1 };
}

export default function QuestionBuilder({
  questions,
  onChange,
}: {
  questions: EditableQuestion[];
  onChange: (next: EditableQuestion[]) => void;
}) {
  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function handleTypeChange(index: number, type: string) {
    const current = questions[index];
    let patch: Partial<EditableQuestion>;
    if (type === "true_false") {
      patch = {
        type,
        options: ["Vrai", "Faux"],
        correctOption: current.correctOption ?? 0,
        correctText: undefined,
      };
    } else if (type === "mcq") {
      patch = {
        type,
        options: current.options && current.options.length >= 2 ? current.options : ["", ""],
        correctOption: current.correctOption ?? 0,
        correctText: undefined,
      };
    } else if (type === "short" || type === "fill_blank") {
      patch = {
        type,
        options: undefined,
        correctOption: undefined,
        correctText: current.correctText ?? "",
      };
    } else {
      patch = { type, options: undefined, correctOption: undefined, correctText: undefined };
    }
    updateQuestion(index, patch);
  }

  function addOption(index: number) {
    updateQuestion(index, { options: [...(questions[index].options ?? []), ""] });
  }

  function removeOption(index: number, optIndex: number) {
    const current = questions[index];
    const options = (current.options ?? []).filter((_, i) => i !== optIndex);
    let correctOption = current.correctOption;
    if (correctOption !== undefined) {
      if (correctOption === optIndex) correctOption = 0;
      else if (correctOption > optIndex) correctOption -= 1;
    }
    updateQuestion(index, { options, correctOption });
  }

  function updateOption(index: number, optIndex: number, text: string) {
    const options = (questions[index].options ?? []).map((o, i) => (i === optIndex ? text : o));
    updateQuestion(index, { options });
  }

  function addQuestion() {
    onChange([...questions, emptyQuestion()]);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
          Aucune question. Clique sur « Ajouter une question » pour commencer.
        </p>
      )}

      {questions.map((q, index) => (
        <div key={index} className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-navy">Question {index + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveQuestion(index, -1)}
                disabled={index === 0}
                className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                aria-label="Monter la question"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveQuestion(index, 1)}
                disabled={index === questions.length - 1}
                className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                aria-label="Descendre la question"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeQuestion(index)}
                className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50"
                aria-label="Supprimer la question"
              >
                🗑️
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label-field">Énoncé de la question</label>
              <textarea
                className="input-field min-h-[70px]"
                value={q.question}
                onChange={(e) => updateQuestion(index, { question: e.target.value })}
                placeholder="Ex : Qui a construit l'arche ?"
              />
            </div>
            <div>
              <label className="label-field">Points</label>
              <input
                type="number"
                min={1}
                className="input-field w-20 text-center"
                value={q.points}
                onChange={(e) => updateQuestion(index, { points: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="label-field">Type de question</label>
            <select
              className="input-field sm:max-w-xs"
              value={q.type}
              onChange={(e) => handleTypeChange(index, e.target.value)}
            >
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {(q.type === "mcq" || q.type === "true_false") && (
            <div className="mt-3">
              <label className="label-field">Options — sélectionne la bonne réponse</label>
              <div className="space-y-2">
                {(q.options ?? []).map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${index}`}
                      checked={q.correctOption === optIndex}
                      onChange={() => updateQuestion(index, { correctOption: optIndex })}
                      className="h-4 w-4 shrink-0 accent-accent"
                      aria-label={`Bonne réponse : option ${optIndex + 1}`}
                    />
                    <input
                      className="input-field flex-1"
                      value={option}
                      disabled={q.type === "true_false"}
                      onChange={(e) => updateOption(index, optIndex, e.target.value)}
                      placeholder={`Option ${optIndex + 1}`}
                    />
                    {q.type === "mcq" && (q.options?.length ?? 0) > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index, optIndex)}
                        className="shrink-0 text-gray-400 hover:text-red-500"
                        aria-label="Supprimer l'option"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {q.type === "mcq" && (
                <button
                  type="button"
                  onClick={() => addOption(index)}
                  className="mt-2 text-sm font-semibold text-accent-dark hover:underline"
                >
                  + Ajouter une option
                </button>
              )}
            </div>
          )}

          {(q.type === "short" || q.type === "fill_blank") && (
            <div className="mt-3">
              <label className="label-field">Bonne réponse attendue</label>
              <input
                className="input-field"
                value={q.correctText ?? ""}
                onChange={(e) => updateQuestion(index, { correctText: e.target.value })}
                placeholder="Ex : Noé"
              />
            </div>
          )}

          {q.type === "open" && (
            <p className="mt-3 rounded-lg bg-navy/5 p-2.5 text-xs text-gray-500">
              Question ouverte : pas de correction automatique, elle ne compte pas dans le score.
            </p>
          )}

          <div className="mt-3">
            <label className="label-field">Justification (optionnel)</label>
            <textarea
              className="input-field min-h-[60px]"
              value={q.justification ?? ""}
              onChange={(e) => updateQuestion(index, { justification: e.target.value })}
              placeholder="Expliquer la bonne réponse — affichée dans les résultats du participant."
            />
          </div>
        </div>
      ))}

      <button type="button" onClick={addQuestion} className="btn-secondary w-full">
        + Ajouter une question
      </button>
    </div>
  );
}
