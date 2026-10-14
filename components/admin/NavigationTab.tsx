"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ADMIN_NAVIGATION,
  normalizeAdminNavigation,
  type AdminNavigationCategory,
  type AdminNavigationConfig,
  type AdminNavigationItem,
} from "@/lib/admin-navigation";

function cloneConfig(config: AdminNavigationConfig): AdminNavigationConfig {
  return JSON.parse(JSON.stringify(config)) as AdminNavigationConfig;
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function NavigationTab({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<AdminNavigationConfig>(cloneConfig(DEFAULT_ADMIN_NAVIGATION));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/navigation", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Impossible de charger la navigation.");
        setConfig(normalizeAdminNavigation(data.navigation));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }, []);

  function updateCategory(categoryId: string, patch: Partial<AdminNavigationCategory>) {
    setConfig((current) => ({
      categories: current.categories.map((category) => category.id === categoryId ? { ...category, ...patch } : category),
    }));
  }

  function updateItem(categoryId: string, itemId: string, patch: Partial<AdminNavigationItem>) {
    setConfig((current) => ({
      categories: current.categories.map((category) => category.id !== categoryId ? category : {
        ...category,
        items: category.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
      }),
    }));
  }

  function moveCategory(categoryId: string, direction: -1 | 1) {
    setConfig((current) => {
      const index = current.categories.findIndex((category) => category.id === categoryId);
      return { categories: move(current.categories, index, direction) };
    });
  }

  function moveItem(categoryId: string, itemId: string, direction: -1 | 1) {
    setConfig((current) => ({
      categories: current.categories.map((category) => {
        if (category.id !== categoryId) return category;
        const index = category.items.findIndex((item) => item.id === itemId);
        return { ...category, items: move(category.items, index, direction) };
      }),
    }));
  }

  function transferItem(fromId: string, itemId: string, toId: string) {
    if (!toId || fromId === toId) return;
    setConfig((current) => {
      const source = current.categories.find((category) => category.id === fromId);
      const item = source?.items.find((candidate) => candidate.id === itemId);
      if (!item) return current;
      return {
        categories: current.categories.map((category) => {
          if (category.id === fromId) return { ...category, items: category.items.filter((candidate) => candidate.id !== itemId) };
          if (category.id === toId) return { ...category, items: [...category.items, item] };
          return category;
        }).filter((category) => category.items.length > 0),
      };
    });
  }

  function promoteItem(categoryId: string, itemId: string) {
    setConfig((current) => {
      const sourceIndex = current.categories.findIndex((category) => category.id === categoryId);
      const source = current.categories[sourceIndex];
      const item = source?.items.find((candidate) => candidate.id === itemId);
      if (!source || !item) return current;
      if (source.items.length === 1 && source.id === `${item.id}-principal`) return current;
      if (current.categories.some((category) => category.id === `${item.id}-principal`)) return current;
      const newCategory: AdminNavigationCategory = {
        id: `${item.id}-principal`,
        icon: "📌",
        label: item.label,
        items: [{ ...item, group: null }],
      };
      const categories = current.categories.map((category) => category.id === categoryId
        ? { ...category, items: category.items.filter((candidate) => candidate.id !== itemId) }
        : category).filter((category) => category.items.length > 0);
      const insertAt = Math.min(sourceIndex + 1, categories.length);
      categories.splice(insertAt, 0, newCategory);
      return { categories };
    });
  }

  function mergeCategory(categoryId: string, targetId: string) {
    if (!targetId || categoryId === targetId) return;
    setConfig((current) => {
      const source = current.categories.find((category) => category.id === categoryId);
      if (!source) return current;
      return {
        categories: current.categories
          .filter((category) => category.id !== categoryId)
          .map((category) => category.id === targetId ? { ...category, items: [...category.items, ...source.items] } : category),
      };
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ navigation: config }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible d'enregistrer la navigation.");
      setConfig(normalizeAdminNavigation(data.navigation));
      setMessage("Organisation des onglets enregistrée.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setConfig(cloneConfig(DEFAULT_ADMIN_NAVIGATION));
    setMessage("Structure par défaut restaurée dans l’éditeur. Clique sur Enregistrer pour l’appliquer.");
  }

  if (loading) return <p className="text-gray-500">Chargement de la navigation...</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="text-lg font-bold text-navy">Organisation des onglets admin</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Renomme les onglets, change les icônes, réorganise l’ordre et déplace les sous-onglets entre les groupes. La fusion d’un groupe déplace tous ses onglets avec lui. La promotion crée un nouvel onglet principal.
        </p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
      {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">{message}</p>}

      <div className="space-y-4">
        {config.categories.map((category, categoryIndex) => (
          <section key={category.id} className="card !p-0 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 px-4 py-4 sm:flex-row sm:items-end">
              <div className="flex gap-2">
                <button type="button" disabled={categoryIndex === 0} onClick={() => moveCategory(category.id, -1)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm disabled:opacity-30" title="Monter">↑</button>
                <button type="button" disabled={categoryIndex === config.categories.length - 1} onClick={() => moveCategory(category.id, 1)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm disabled:opacity-30" title="Descendre">↓</button>
              </div>
              <label className="flex-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">Onglet principal<input value={category.label} onChange={(e) => updateCategory(category.id, { label: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-navy" /></label>
              <label className="w-20 text-[11px] font-bold uppercase tracking-wide text-gray-400">Icône<input value={category.icon} onChange={(e) => updateCategory(category.id, { icon: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-lg" maxLength={8} /></label>
              {config.categories.length > 1 && <select defaultValue="" onChange={(e) => { mergeCategory(category.id, e.target.value); e.currentTarget.value = ""; }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600"><option value="">Fusionner dans…</option>{config.categories.filter((candidate) => candidate.id !== category.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.icon} {candidate.label}</option>)}</select>}
            </div>

            <div className="divide-y divide-gray-100">
              {category.items.map((item, itemIndex) => (
                <div key={item.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[auto_1fr_1fr_auto] lg:items-center">
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={itemIndex === 0} onClick={() => moveItem(category.id, item.id, -1)} className="rounded border border-gray-200 px-1.5 py-0.5 text-xs disabled:opacity-30">↑</button>
                    <button type="button" disabled={itemIndex === category.items.length - 1} onClick={() => moveItem(category.id, item.id, 1)} className="rounded border border-gray-200 px-1.5 py-0.5 text-xs disabled:opacity-30">↓</button>
                  </div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Onglet<input value={item.label} onChange={(e) => updateItem(category.id, item.id, { label: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-navy" /></label>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Groupe sous-onglet<input value={item.group ?? ""} onChange={(e) => updateItem(category.id, item.id, { group: e.target.value || null })} placeholder="Aucun groupe" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600" /></label>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <select defaultValue="" onChange={(e) => { transferItem(category.id, item.id, e.target.value); e.currentTarget.value = ""; }} className="rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600"><option value="">Déplacer vers…</option>{config.categories.filter((candidate) => candidate.id !== category.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.icon} {candidate.label}</option>)}</select>
                    <button type="button" onClick={() => promoteItem(category.id, item.id)} className="rounded-lg border border-accent/30 px-2.5 py-2 text-xs font-semibold text-accent-dark hover:bg-accent/5">Principal</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button type="button" onClick={reset} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Réinitialiser</button>
        <button type="button" onClick={save} disabled={saving} className="btn-accent">{saving ? "Enregistrement…" : "Enregistrer la navigation"}</button>
      </div>
    </div>
  );
}
