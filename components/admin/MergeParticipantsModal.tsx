"use client";

import { useState } from "react";

interface Participant {
  id: string;
  name: string;
  parish: string;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
}

type FieldKey = "name" | "parish" | "email" | "whatsapp";

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Nom",
  parish: "Paroisse",
  email: "Email",
  whatsapp: "WhatsApp",
};

export default function MergeParticipantsModal({
  candidates,
  onClose,
  onMerged,
}: {
  candidates: Participant[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const [targetId, setTargetId] = useState(candidates[0]?.id ?? "");
  const [fieldChoices, setFieldChoices] = useState<Record<FieldKey, string>>({
    name: candidates[0]?.id ?? "",
    parish: candidates[0]?.id ?? "",
    email: candidates[0]?.id ?? "",
    whatsapp: candidates[0]?.id ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function valueFor(candidateId: string, field: FieldKey): string {
    const c = candidates.find((cand) => cand.id === candidateId);
    if (!c) return "—";
    const v = c[field];
    return v && v.trim() ? v : "—";
  }

  async function handleMerge() {
    setError("");
    setSubmitting(true);
    try {
      const sourceIds = candidates.map((c) => c.id).filter((id) => id !== targetId);
      const fields: Record<FieldKey, string | null> = {
        name: valueFor(fieldChoices.name, "name"),
        parish: valueFor(fieldChoices.parish, "parish"),
        email: valueFor(fieldChoices.email, "email") === "—" ? null : valueFor(fieldChoices.email, "email"),
        whatsapp:
          valueFor(fieldChoices.whatsapp, "whatsapp") === "—"
            ? null
            : valueFor(fieldChoices.whatsapp, "whatsapp"),
      };

      const res = await fetch("/api/admin/participants/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ targetId, sourceIds, fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la fusion.");
      }
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldKeys: FieldKey[] = ["name", "parish", "email", "whatsapp"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">Fusionner {candidates.length} fiches</h2>
            <p className="text-sm text-gray-500">
              Choisis la fiche principale et les informations à conserver pour chaque champ.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="mb-5">
          <p className="label-field">Fiche principale (conservée, les autres seront supprimées)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-colors ${
                  targetId === c.id ? "border-accent bg-accent/5" : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  checked={targetId === c.id}
                  onChange={() => setTargetId(c.id)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-navy">{c.name}</span>
                <span className="text-xs text-gray-400">
                  · inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {fieldKeys.map((field) => (
            <div key={field}>
              <p className="label-field">{FIELD_LABELS[field]}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {candidates.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-colors ${
                      fieldChoices[field] === c.id ? "border-accent bg-accent/5" : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`field-${field}`}
                      checked={fieldChoices[field] === c.id}
                      onChange={() => setFieldChoices((prev) => ({ ...prev, [field]: c.id }))}
                      className="h-4 w-4"
                    />
                    <span className="truncate text-navy">{valueFor(c.id, field)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? "Fusion..." : "Fusionner"}
          </button>
        </div>
      </div>
    </div>
  );
}
