"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { SiteUpdate } from "@/lib/types";

export default function UpdatesTab() {
  const toast = useToast();
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🆕");
  const [linkHref, setLinkHref] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    fetch("/api/admin/updates", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les nouveautés.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement.");
        }
        setUpdates(data.updates ?? []);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ title, description, icon, linkHref, linkLabel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout.");
      }
      setUpdates((prev) => [data.update, ...prev]);
      setTitle("");
      setDescription("");
      setIcon("🆕");
      setLinkHref("");
      setLinkLabel("");
      toast.success("Nouveauté ajoutée.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = updates;
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    try {
      const res = await fetch(`/api/admin/updates/${id}`, { method: "DELETE", cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la suppression.");
      }
      toast.success("Nouveauté supprimée.");
    } catch (err) {
      setUpdates(previous);
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-navy">🆕 Nouveautés</h2>
      <p className="mb-4 text-sm text-gray-500">
        Chaque entrée apparaît brièvement (titre + description courte, avec un lien facultatif)
        aux visiteurs qui ne l&apos;ont pas encore vue, dans un pop-up qu&apos;ils peuvent fermer.
        La plus récente en haut.
      </p>

      <form onSubmit={handleAdd} className="card mb-6 space-y-3">
        <h3 className="text-sm font-bold text-navy">Ajouter une nouveauté</h3>
        <div>
          <label className="label-field" htmlFor="update-title">
            Titre
          </label>
          <input
            id="update-title"
            className="input-field"
            placeholder="Ex : Nouveau jeu : Trouve le verset !"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="update-description">
            Description courte
          </label>
          <textarea
            id="update-description"
            className="input-field min-h-[60px]"
            placeholder="Une phrase ou deux, l'essentiel seulement."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="update-icon">
            Icône (emoji affiché dans le badge)
          </label>
          <input
            id="update-icon"
            className="input-field w-24 text-center text-xl"
            maxLength={8}
            placeholder="🆕"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-field" htmlFor="update-link-href">
              Lien (facultatif)
            </label>
            <input
              id="update-link-href"
              className="input-field"
              placeholder="/jeux"
              value={linkHref}
              onChange={(e) => setLinkHref(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field" htmlFor="update-link-label">
              Texte du bouton
            </label>
            <input
              id="update-link-label"
              className="input-field"
              placeholder="Découvrir"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
            />
          </div>
        </div>
        {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting || !title.trim() || !description.trim()}
          className="btn-accent"
        >
          {submitting ? "Ajout..." : "Ajouter"}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : error && updates.length === 0 ? (
        <div>
          <p className="text-sm font-medium text-red-600">{error}</p>
          {error.includes("Session expirée") && (
            <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
              Se reconnecter →
            </a>
          )}
        </div>
      ) : updates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Aucune nouveauté enregistrée.
        </p>
      ) : (
        <>
          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
          <ul className="space-y-2">
            {updates.map((u) => (
              <li
                key={u.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-navy">
                    <span className="mr-1">{u.icon}</span>
                    {u.title}
                  </p>
                  <p className="text-sm text-gray-600">{u.description}</p>
                  {u.link_href && (
                    <p className="mt-1 text-xs text-gray-400">
                      Lien : <span className="font-semibold text-accent-dark">{u.link_href}</span> (
                      {u.link_label})
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(u.id)}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
