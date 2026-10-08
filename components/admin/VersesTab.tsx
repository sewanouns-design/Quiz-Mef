"use client";

import { useEffect, useState } from "react";
import type { BibleVerse } from "@/lib/types";

const PAGE_SIZE = 50;

export default function VersesTab() {
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [blankWord, setBlankWord] = useState("");
  const [level, setLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReference, setEditReference] = useState("");
  const [editText, setEditText] = useState("");
  const [editBlankWord, setEditBlankWord] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState("");
  const [bulkProgress, setBulkProgress] = useState("");

  const [recalculating, setRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState("");
  const [recalculateError, setRecalculateError] = useState("");

  // Même taille que MAX_ITEMS_PER_REQUEST côté serveur
  // (app/api/admin/verses/bulk/route.ts) : un fichier plus volumineux est
  // envoyé en plusieurs requêtes successives plutôt qu'en une seule, pour
  // qu'un import de plusieurs milliers de versets passe sans problème.
  const BULK_CHUNK_SIZE = 1000;

  useEffect(() => {
    load();
    setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  function load(overrides?: { page?: number; search?: string }) {
    const effectivePage = overrides?.page ?? page;
    const effectiveSearch = overrides?.search ?? search;
    setLoading(true);
    const params = new URLSearchParams({ page: String(effectivePage), limit: String(PAGE_SIZE) });
    if (effectiveSearch) params.set("search", effectiveSearch);
    fetch(`/api/admin/verses?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les versets.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des versets.");
        }
        setVerses(data.verses ?? []);
        setTotal(data.total ?? 0);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !text.trim()) return;

    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/verses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ reference, text, blankWord, level: level ? Number(level) : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout.");
      }
      setPage(1);
      setSearch("");
      setSearchInput("");
      load({ page: 1, search: "" });
      setReference("");
      setText("");
      setBlankWord("");
      setLevel("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  function parseBulkText(raw: string) {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
          reference: parts[0] ?? "",
          text: parts[1] ?? "",
          blankWord: parts[2] ?? "",
          level: parts[3] ?? "",
        };
      });
  }

  async function importItems(
    items: { reference: string; text: string; blankWord: string; level?: string }[]
  ) {
    setBulkSubmitting(true);
    setBulkError("");
    setBulkResult("");
    setBulkProgress("");

    let totalImported = 0;
    const allRejected: { line: number; reason: string }[] = [];

    try {
      for (let i = 0; i < items.length; i += BULK_CHUNK_SIZE) {
        const chunk = items.slice(i, i + BULK_CHUNK_SIZE);
        if (items.length > BULK_CHUNK_SIZE) {
          setBulkProgress(
            `Envoi en cours... ${Math.min(i + BULK_CHUNK_SIZE, items.length)} / ${items.length}`
          );
        }

        const res = await fetch("/api/admin/verses/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ verses: chunk }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error ||
              `Erreur lors de l'import (lots ${totalImported} verset(s) déjà importé(s) avant l'erreur).`
          );
        }
        totalImported += data.imported ?? 0;
        if (Array.isArray(data.rejected)) {
          for (const r of data.rejected) {
            allRejected.push({ line: i + r.line, reason: r.reason });
          }
        }
      }

      setBulkProgress("");
      setBulkResult(
        `${totalImported} verset(s) importé(s).` +
          (allRejected.length > 0
            ? ` ${allRejected.length} ligne(s) ignorée(s) (voir ci-dessous).`
            : "")
      );
      if (allRejected.length > 0) {
        setBulkError(allRejected.map((r) => `Ligne ${r.line} : ${r.reason}`).join(" · "));
      }
      setPage(1);
      setSearch("");
      setSearchInput("");
      load({ page: 1, search: "" });
    } catch (err) {
      setBulkProgress("");
      setBulkError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    const items = parseBulkText(bulkText);
    if (items.length === 0) return;
    await importItems(items);
    setBulkText("");
  }

  async function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const raw = await file.text();
    const items = parseBulkText(raw);
    if (items.length === 0) {
      setBulkError("Le fichier ne contient aucune ligne au bon format.");
      return;
    }
    await importItems(items);
  }

  async function handleRecalculateLevels() {
    setRecalculating(true);
    setRecalculateError("");
    setRecalculateResult("");
    try {
      const res = await fetch("/api/admin/verses/recalculate-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du recalcul.");
      }
      setRecalculateResult(
        data.updated > 0
          ? `${data.updated} verset(s) reclassé(s) selon leur vrai taux d'échec.`
          : "Pas encore assez de réponses enregistrées pour reclasser de versets."
      );
      load();
    } catch (err) {
      setRecalculateError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setRecalculating(false);
    }
  }

  function startEdit(v: BibleVerse) {
    setEditingId(v.id);
    setEditReference(v.reference);
    setEditText(v.text);
    setEditBlankWord(v.blank_word ?? "");
    setEditLevel(v.level ? String(v.level) : "");
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editReference.trim() || !editText.trim()) return;

    setEditSubmitting(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/verses/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          reference: editReference,
          text: editText,
          blankWord: editBlankWord,
          level: editLevel ? Number(editLevel) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la modification.");
      }
      setVerses((prev) => prev.map((v) => (v.id === editingId ? data.verse : v)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-navy">📖 Trouve le verset</h2>
      <p className="mb-4 text-sm text-gray-500">
        Banque de versets utilisée par le jeu permanent &quot;Trouve le verset&quot; (accessible depuis
        l&apos;accueil). Le mot à deviner est facultatif : sans lui, le verset ne sert qu&apos;à la
        variante &quot;devine la référence&quot;.{" "}
        {total > 0 && <span className="font-semibold text-navy">{total} verset(s) en base.</span>}
      </p>

      <form onSubmit={handleAdd} className="card mb-6 space-y-3">
        <h3 className="text-sm font-bold text-navy">Ajouter un verset</h3>
        <div>
          <label className="label-field" htmlFor="verse-reference">
            Référence
          </label>
          <input
            id="verse-reference"
            className="input-field"
            placeholder="Ex : Jean 3:16"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="verse-text">
            Texte complet du verset
          </label>
          <textarea
            id="verse-text"
            className="input-field min-h-[80px]"
            placeholder="Texte exact du verset..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="verse-blank">
            Mot à deviner (facultatif)
          </label>
          <input
            id="verse-blank"
            className="input-field"
            placeholder="Doit apparaître exactement tel quel dans le texte ci-dessus"
            value={blankWord}
            onChange={(e) => setBlankWord(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field" htmlFor="verse-level">
            Niveau 1-100 (facultatif)
          </label>
          <input
            id="verse-level"
            type="number"
            min={1}
            max={100}
            className="input-field"
            placeholder="Automatique (selon la longueur du texte)"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </div>
        {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting || !reference.trim() || !text.trim()}
          className="btn-accent"
        >
          {submitting ? "Ajout..." : "Ajouter"}
        </button>
      </form>

      <form onSubmit={handleBulkImport} className="card mb-6 space-y-3">
        <h3 className="text-sm font-bold text-navy">Importer plusieurs versets en une fois</h3>
        <p className="text-xs text-gray-500">
          Un verset par ligne, champs séparés par <code className="rounded bg-gray-100 px-1">|</code> :{" "}
          <code className="rounded bg-gray-100 px-1">
            Référence | Texte complet | Mot à deviner (facultatif) | Niveau 1-100 (facultatif)
          </code>
          <br />
          Exemple : <code className="rounded bg-gray-100 px-1">
            Jean 3:16 | Car Dieu a tant aimé le monde... | aimé
          </code>
          <br />
          Même format par collage ci-dessous ou par fichier <code className="rounded bg-gray-100 px-1">.txt</code>{" "}
          — un fichier peut contenir des milliers de versets, il est envoyé automatiquement par lots.{" "}
          <a href="/exemple-versets.txt" download className="font-semibold text-accent-dark hover:underline">
            Télécharger un exemple de fichier →
          </a>
        </p>
        <textarea
          className="input-field min-h-[140px] font-mono text-xs"
          placeholder={"Jean 3:16 | Car Dieu a tant aimé le monde qu'il a donné son Fils unique... | aimé\nPsaume 23:1 | L'Éternel est mon berger : je ne manquerai de rien."}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        {bulkProgress && <p className="text-sm font-medium text-gray-500">{bulkProgress}</p>}
        {bulkResult && <p className="text-sm font-medium text-green-700">{bulkResult}</p>}
        {bulkError && <p className="text-sm font-medium text-red-600">{bulkError}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={bulkSubmitting || !bulkText.trim()} className="btn-accent">
            {bulkSubmitting ? "Import..." : "Importer le texte collé"}
          </button>
          <span className="text-xs text-gray-400">ou</span>
          <label
            className={`cursor-pointer rounded-lg border border-navy/20 px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-navy/5 ${
              bulkSubmitting ? "pointer-events-none opacity-50" : ""
            }`}
          >
            📄 Importer un fichier .txt
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              disabled={bulkSubmitting}
              onChange={handleBulkFile}
            />
          </label>
        </div>
      </form>

      <div className="card mb-6 space-y-2">
        <h3 className="text-sm font-bold text-navy">Reclasser les niveaux selon la vraie difficulté</h3>
        <p className="text-xs text-gray-500">
          Un verset court n&apos;est pas forcément facile : ce bouton reclasse les niveaux à partir du
          taux d&apos;échec réel des joueurs (enregistré à chaque partie), pas de la longueur du texte.
          Seuls les versets ayant déjà assez de réponses sont reclassés.
        </p>
        {recalculateResult && <p className="text-sm font-medium text-green-700">{recalculateResult}</p>}
        {recalculateError && <p className="text-sm font-medium text-red-600">{recalculateError}</p>}
        <button
          type="button"
          onClick={handleRecalculateLevels}
          disabled={recalculating}
          className="btn-secondary"
        >
          {recalculating ? "Recalcul en cours..." : "🔄 Reclasser selon la difficulté réelle"}
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-3 flex gap-2">
        <input
          className="input-field"
          placeholder="Rechercher par référence ou texte..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn-accent shrink-0">
          Rechercher
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            Effacer
          </button>
        )}
      </form>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : error && verses.length === 0 ? (
        <div>
          <p className="text-sm font-medium text-red-600">{error}</p>
          {error.includes("Session expirée") && (
            <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
              Se reconnecter →
            </a>
          )}
        </div>
      ) : verses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          {search ? "Aucun verset ne correspond à cette recherche." : "Aucun verset enregistré."}
        </p>
      ) : (
        <>
          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}

          <p className="mb-2 text-xs text-gray-400">
            La suppression de versets est désactivée pour le moment — tu peux les modifier.
          </p>

          <ul className="space-y-2">
            {verses.map((v) =>
              editingId === v.id ? (
                <li key={v.id} className="card space-y-2">
                  <input
                    className="input-field"
                    value={editReference}
                    onChange={(e) => setEditReference(e.target.value)}
                    placeholder="Référence"
                  />
                  <textarea
                    className="input-field min-h-[70px]"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Texte du verset"
                  />
                  <input
                    className="input-field"
                    value={editBlankWord}
                    onChange={(e) => setEditBlankWord(e.target.value)}
                    placeholder="Mot à deviner (facultatif)"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="input-field"
                    placeholder="Niveau 1-100 (automatique si vide)"
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                  />
                  {editError && <p className="text-sm font-medium text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={editSubmitting || !editReference.trim() || !editText.trim()}
                      className="btn-accent"
                    >
                      {editSubmitting ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={v.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy">{v.reference}</p>
                      {v.level && (
                        <span className="shrink-0 rounded-full bg-navy/5 px-2 py-0.5 text-[11px] font-semibold text-navy/70">
                          Niveau {v.level}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{v.text}</p>
                    {v.blank_word && (
                      <p className="mt-1 text-xs text-gray-400">
                        Mot à deviner : <span className="font-semibold text-accent-dark">{v.blank_word}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-gray-50"
                    >
                      Modifier
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-40"
              >
                ← Précédent
              </button>
              <span className="text-xs text-gray-500">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
