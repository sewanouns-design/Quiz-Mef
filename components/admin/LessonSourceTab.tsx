"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";

type LessonSource = {
  id: string;
  name: string;
  file_size_bytes: number;
  mime_type: string;
  lesson_start: number;
  quarter_start: string | null;
  quarter_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDate(value: string | null): string {
  if (!value) return "Non précisée";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

export default function LessonSourceTab() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<LessonSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [lessonStart, setLessonStart] = useState("7");
  const [quarterStart, setQuarterStart] = useState("");
  const [quarterEnd, setQuarterEnd] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLessonStart, setEditLessonStart] = useState("7");
  const [editQuarterStart, setEditQuarterStart] = useState("");
  const [editQuarterEnd, setEditQuarterEnd] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadSources() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/lesson-source", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de charger les sources.");
      setSources(data.sources ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError("");
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Sélectionne d’abord le PDF du trimestre.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("lessonStart", lessonStart);
      form.set("quarterStart", quarterStart);
      form.set("quarterEnd", quarterEnd);
      const response = await fetch("/api/admin/lesson-source", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Import impossible.");
      setSources((current) => [data.source, ...current.map((source) => ({ ...source, is_active: false }))]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("PDF importé et activé pour l’automatisation.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function startEditing(source: LessonSource) {
    setEditingId(source.id);
    setEditName(source.name);
    setEditLessonStart(String(source.lesson_start));
    setEditQuarterStart(source.quarter_start ?? "");
    setEditQuarterEnd(source.quarter_end ?? "");
    setError("");
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveEditing(source: LessonSource) {
    setSavingId(source.id);
    setError("");
    try {
      const response = await fetch("/api/admin/lesson-source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          name: editName,
          lessonStart: editLessonStart,
          quarterStart: editQuarterStart,
          quarterEnd: editQuarterEnd,
        }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Modification impossible.");
      setSources((current) => current.map((item) => (item.id === source.id ? data.source : item)));
      setEditingId(null);
      toast.success("Source modifiée.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSource(source: LessonSource) {
    if (source.is_active) {
      toast.error("Active d’abord une autre source avant de supprimer celle-ci.");
      return;
    }
    if (!window.confirm(`Supprimer définitivement la source « ${source.name} » ?`)) return;
    setDeletingId(source.id);
    setError("");
    try {
      const response = await fetch("/api/admin/lesson-source", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: source.id }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Suppression impossible.");
      setSources((current) => current.filter((item) => item.id !== source.id));
      toast.success("Source supprimée.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  const activeSource = sources.find((source) => source.is_active);

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-bold text-navy">📚 Source du trimestre</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Dépose ici le PDF officiel du trimestre. Il sera conservé dans un stockage privé, son
          texte sera extrait automatiquement, puis l’automatisation n’utilisera que la leçon active
          ou les articulations de la semaine. Le PDF n’est pas ajouté à GitHub ni au déploiement.
        </p>
        <form onSubmit={handleUpload} className="mt-5 space-y-4">
          <div>
            <label className="label-field" htmlFor="lesson-source-file">PDF du trimestre</label>
            <input
              ref={fileRef}
              id="lesson-source-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {file && <p className="mt-1 text-xs text-gray-500">{file.name} · {formatBytes(file.size)}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label-field" htmlFor="lesson-source-start">Première leçon</label>
              <input
                id="lesson-source-start"
                type="number"
                min="1"
                max="100"
                value={lessonStart}
                onChange={(event) => setLessonStart(event.target.value)}
                className="input-field"
              />
              <p className="mt-1 text-xs text-gray-500">Numéro de la première leçon à produire. Pour ton PDF actuel : 7.</p>
            </div>
            <div>
              <label className="label-field" htmlFor="lesson-source-quarter-start">Début du trimestre (PDF)</label>
              <input
                id="lesson-source-quarter-start"
                type="date"
                value={quarterStart}
                onChange={(event) => setQuarterStart(event.target.value)}
                className="input-field"
              />
              <p className="mt-1 text-xs text-gray-500">Pour ce livret : 06/09/2026. La leçon 7 commence le 12/10/2026.</p>
            </div>
            <div>
              <label className="label-field" htmlFor="lesson-source-quarter-end">Fin du trimestre (PDF)</label>
              <input
                id="lesson-source-quarter-end"
                type="date"
                value={quarterEnd}
                onChange={(event) => setQuarterEnd(event.target.value)}
                className="input-field"
              />
              <p className="mt-1 text-xs text-gray-500">Pour ce livret : 29/11/2026.</p>
            </div>
          </div>
          <button type="submit" disabled={uploading || !file} className="btn-primary">
            {uploading ? "Lecture et import du PDF..." : "Importer et activer cette source"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-navy">Source actuellement utilisée</h2>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">Chargement...</p>
        ) : activeSource ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950">
            <p className="font-semibold">{activeSource.name}</p>
            <p className="mt-1">Leçon de départ : {activeSource.lesson_start} · {formatBytes(activeSource.file_size_bytes)}</p>
            <p className="mt-1">Période : {formatDate(activeSource.quarter_start)} → {formatDate(activeSource.quarter_end)}</p>
            <p className="mt-2 text-xs">Cette source est celle que l’automatisation doit utiliser.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-amber-700">Aucune source active. Importe le PDF du trimestre.</p>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-navy">Historique des sources</h2>
        <div className="mt-3 space-y-2">
          {sources.length === 0 && !loading && <p className="text-sm text-gray-500">Aucun PDF importé.</p>}
          {sources.map((source) => (
            editingId === source.id ? (
              <div key={source.id} className="rounded-lg border border-accent-light bg-white p-4 text-sm">
                <p className="font-semibold text-navy">Modifier la source</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label-field" htmlFor={`source-name-${source.id}`}>Nom</label>
                    <input id={`source-name-${source.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="label-field" htmlFor={`source-lesson-${source.id}`}>Première leçon</label>
                    <input id={`source-lesson-${source.id}`} type="number" min="1" max="100" value={editLessonStart} onChange={(event) => setEditLessonStart(event.target.value)} className="input-field" />
                  </div>
                  <div />
                  <div>
                    <label className="label-field" htmlFor={`source-start-${source.id}`}>Début du trimestre</label>
                    <input id={`source-start-${source.id}`} type="date" value={editQuarterStart} onChange={(event) => setEditQuarterStart(event.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="label-field" htmlFor={`source-end-${source.id}`}>Fin du trimestre</label>
                    <input id={`source-end-${source.id}`} type="date" value={editQuarterEnd} onChange={(event) => setEditQuarterEnd(event.target.value)} className="input-field" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => saveEditing(source)} disabled={savingId === source.id} className="btn-primary">
                    {savingId === source.id ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  <button type="button" onClick={cancelEditing} className="btn-secondary">Annuler</button>
                </div>
              </div>
            ) : (
              <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 text-sm">
                <div>
                  <p className="font-semibold text-gray-800">{source.name}</p>
                  <p className="text-xs text-gray-500">Importé le {formatDate(source.created_at.slice(0, 10))} · {formatBytes(source.file_size_bytes)} · Leçon {source.lesson_start}</p>
                  <p className="text-xs text-gray-500">{formatDate(source.quarter_start)} → {formatDate(source.quarter_end)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${source.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {source.is_active ? "Active" : "Archive"}
                  </span>
                  <button type="button" onClick={() => startEditing(source)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-accent hover:text-navy">Modifier</button>
                  <button type="button" onClick={() => deleteSource(source)} disabled={source.is_active || deletingId === source.id} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                    {deletingId === source.id ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      </section>
    </div>
  );
}
