"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

type ScriptureVerse = { reference: string; text: string };
type DailyLesson = {
  date: string;
  lessonNumber: number;
  title: string;
  reference: string;
  scriptureVerses: ScriptureVerse[];
  body: string;
  essential: string;
  prayer: string;
};
type Override = {
  id: string;
  lessonDate: string;
  lessonNumber: number;
  title: string;
  reference: string;
  scriptureVerses: ScriptureVerse[];
  body: string;
  essential: string;
  prayer: string;
  isVisible: boolean;
  updatedAt: string;
};

type FormState = {
  lessonNumber: string;
  title: string;
  reference: string;
  scriptureText: string;
  body: string;
  essential: string;
  prayer: string;
  isVisible: boolean;
};

function localDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Porto-Novo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function emptyForm(): FormState {
  return {
    lessonNumber: "7",
    title: "",
    reference: "",
    scriptureText: "",
    body: "",
    essential: "",
    prayer: "",
    isVisible: true,
  };
}

function formFromLesson(lesson: DailyLesson | null, override: Override | null): FormState {
  const value = override ?? lesson;
  if (!value) return emptyForm();
  return {
    lessonNumber: String(value.lessonNumber),
    title: value.title,
    reference: value.reference,
    scriptureText: value.scriptureVerses.map((verse) => verse.text).join("\n\n"),
    body: value.body,
    essential: value.essential,
    prayer: value.prayer,
    isVisible: override?.isVisible ?? true,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00Z`));
}

export default function DailyLessonTab() {
  const toast = useToast();
  const [lessonDate, setLessonDate] = useState(localDateKey());
  const [sourceLesson, setSourceLesson] = useState<DailyLesson | null>(null);
  const [override, setOverride] = useState<Override | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function loadDate(date = lessonDate) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/daily-lesson?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de charger la leçon.");
      const nextOverride = data.override ?? null;
      const nextSourceLesson = data.sourceLesson ?? null;
      setSourceLesson(nextSourceLesson);
      setOverride(nextOverride);
      setOverrides(data.overrides ?? []);
      setForm(formFromLesson(nextOverride ? data.lesson : nextSourceLesson ?? data.lesson, nextOverride));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDate();
    // Le chargement initial doit suivre la date choisie dans le champ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(field: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function loadPdfIntoForm() {
    setForm(formFromLesson(sourceLesson, null));
    toast.success("Contenu extrait du PDF chargé dans le formulaire. Enregistre-le pour créer une personnalisation.");
  }

  async function save(event: React.FormEvent, visible: boolean) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    if (form.scriptureText.trim() && !form.reference.trim()) {
      setError("Ajoute la référence biblique avant d’enregistrer le texte du passage.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/daily-lesson", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonDate,
          lessonNumber: form.lessonNumber,
          title: form.title,
          reference: form.reference,
          scriptureVerses: form.scriptureText.trim()
            ? [{ reference: form.reference, text: form.scriptureText }]
            : [],
          body: form.body,
          essential: form.essential,
          prayer: form.prayer,
          isVisible: visible,
        }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setForm((current) => ({ ...current, isVisible: visible }));
      toast.success(visible ? "Leçon enregistrée et affichée." : "Leçon enregistrée mais masquée.");
      await loadDate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility() {
    if (!override) return;
    setChangingVisibility(true);
    try {
      const response = await fetch("/api/admin/daily-lesson", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: override.id, isVisible: !override.isVisible }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Modification impossible.");
      toast.success(data.override?.isVisible ? "Leçon affichée." : "Leçon masquée.");
      await loadDate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setChangingVisibility(false);
    }
  }

  async function restorePdf() {
    if (!override) return;
    if (!window.confirm(`Supprimer la personnalisation du ${formatDate(lessonDate)} et revenir au contenu du PDF ?`)) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/admin/daily-lesson", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: override.id }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Restauration impossible.");
      toast.success("Personnalisation supprimée : le contenu du PDF est de nouveau utilisé.");
      await loadDate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-bold text-navy">📖 Leçon du jour — contrôle complet</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Le PDF reste la source par défaut. Pour une date donnée, tu peux créer une personnalisation complète,
          modifier tous les textes, l’afficher, la masquer ou supprimer cette personnalisation pour revenir au PDF.
          Aucune action ici n’envoie de notification.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label-field" htmlFor="daily-lesson-date">Date à gérer</label>
            <input
              id="daily-lesson-date"
              type="date"
              value={lessonDate}
              onChange={(event) => setLessonDate(event.target.value)}
              className="input-field"
            />
          </div>
          <button type="button" onClick={() => loadDate()} disabled={loading} className="btn-secondary">
            {loading ? "Chargement..." : "Charger cette date"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={`rounded-full px-3 py-1 ${override ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
            {override ? "Personnalisation admin" : "Contenu extrait du PDF"}
          </span>
          {override && (
            <span className={`rounded-full px-3 py-1 ${override.isVisible ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
              {override.isVisible ? "Visible publiquement" : "Masquée publiquement"}
            </span>
          )}
        </div>
      </section>

      <form onSubmit={(event) => save(event, true)} className="card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">Éditer la leçon du {formatDate(lessonDate)}</h2>
            <p className="mt-1 text-sm text-gray-500">Ces champs contrôlent directement l’affichage public de cette date.</p>
          </div>
          {sourceLesson && (
            <button type="button" onClick={loadPdfIntoForm} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              Recharger depuis le PDF
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div>
            <label className="label-field" htmlFor="daily-lesson-number">N° de leçon</label>
            <input id="daily-lesson-number" type="number" min="1" max="100" value={form.lessonNumber} onChange={(event) => update("lessonNumber", event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="daily-lesson-title">Titre de la journée</label>
            <input id="daily-lesson-title" value={form.title} onChange={(event) => update("title", event.target.value)} className="input-field" placeholder="Ex. Marchons dans la voie de Dieu" />
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="daily-lesson-reference">Référence biblique</label>
          <input id="daily-lesson-reference" value={form.reference} onChange={(event) => update("reference", event.target.value)} className="input-field" placeholder="Ex. Michée 1:1-5" />
        </div>

        <div>
          <label className="label-field" htmlFor="daily-lesson-scripture">Texte biblique — Louis Second</label>
          <textarea id="daily-lesson-scripture" value={form.scriptureText} onChange={(event) => update("scriptureText", event.target.value)} className="input-field min-h-36" placeholder="Colle ici le contenu des versets associés à la référence." />
          <p className="mt-1 text-xs text-gray-500">Le texte est affiché juste après le grand titre sur la page publique.</p>
        </div>

        <div>
          <label className="label-field" htmlFor="daily-lesson-body">Développement</label>
          <textarea id="daily-lesson-body" value={form.body} onChange={(event) => update("body", event.target.value)} className="input-field min-h-64" placeholder="Contenu principal de la leçon" />
        </div>

        <div>
          <label className="label-field" htmlFor="daily-lesson-essential">Point essentiel</label>
          <textarea id="daily-lesson-essential" value={form.essential} onChange={(event) => update("essential", event.target.value)} className="input-field min-h-24" placeholder="Résumé essentiel de la journée" />
        </div>

        <div>
          <label className="label-field" htmlFor="daily-lesson-prayer">Prière</label>
          <textarea id="daily-lesson-prayer" value={form.prayer} onChange={(event) => update("prayer", event.target.value)} className="input-field min-h-24" placeholder="Axe de prière" />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button type="submit" disabled={saving || loading} className="btn-primary">
            {saving ? "Enregistrement..." : "Enregistrer et afficher"}
          </button>
          <button type="button" disabled={saving || loading} onClick={(event) => save(event as unknown as React.FormEvent, false)} className="btn-secondary">
            Enregistrer mais masquer
          </button>
          {override && (
            <>
              <button type="button" disabled={changingVisibility || deleting} onClick={toggleVisibility} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">
                {changingVisibility ? "..." : override.isVisible ? "Désactiver l’affichage" : "Réactiver l’affichage"}
              </button>
              <button type="button" disabled={deleting || changingVisibility} onClick={restorePdf} className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700 hover:bg-red-50">
                {deleting ? "Restauration..." : "Supprimer la personnalisation"}
              </button>
            </>
          )}
        </div>
      </form>

      <section className="card">
        <h2 className="text-lg font-bold text-navy">Historique des personnalisations</h2>
        <p className="mt-1 text-sm text-gray-500">Supprimer une ligne ne supprime pas le PDF : cela restaure le contenu extrait pour cette date.</p>
        <div className="mt-4 space-y-2">
          {overrides.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune personnalisation enregistrée.</p>
          ) : (
            overrides.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                <div>
                  <p className="font-semibold text-gray-800">{formatDate(item.lessonDate)} — {item.title}</p>
                  <p className="text-xs text-gray-500">Leçon {item.lessonNumber} · {item.isVisible ? "visible" : "masquée"} · modifiée le {formatDate(item.updatedAt.slice(0, 10))}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setLessonDate(item.lessonDate); loadDate(item.lessonDate); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-accent hover:text-navy">Modifier</button>
                  <button type="button" onClick={() => { setLessonDate(item.lessonDate); loadDate(item.lessonDate); }} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Ouvrir</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
