"use client";

import { useEffect, useState } from "react";
import type { BibleVerse } from "@/lib/types";

export default function VersesTab() {
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [blankWord, setBlankWord] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [bulkText, setBulkText] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState("");

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    fetch("/api/admin/verses", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les versets.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des versets.");
        }
        setVerses(data.verses ?? []);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Une erreur est survenue."))
      .finally(() => setLoading(false));
  }

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
        body: JSON.stringify({ reference, text, blankWord }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout.");
      }
      setVerses((prev) => [data.verse, ...prev]);
      setReference("");
      setText("");
      setBlankWord("");
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
        };
      });
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    const items = parseBulkText(bulkText);
    if (items.length === 0) return;

    setBulkSubmitting(true);
    setBulkError("");
    setBulkResult("");
    try {
      const res = await fetch("/api/admin/verses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ verses: items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'import.");
      }
      const rejectedCount = data.rejected?.length ?? 0;
      setBulkResult(
        `${data.imported ?? 0} verset(s) importé(s).` +
          (rejectedCount > 0 ? ` ${rejectedCount} ligne(s) ignorée(s) (voir ci-dessous).` : "")
      );
      if (rejectedCount > 0) {
        setBulkError(
          data.rejected
            .map((r: { line: number; reason: string }) => `Ligne ${r.line} : ${r.reason}`)
            .join(" · ")
        );
      }
      setBulkText("");
      load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = verses;
    setVerses((prev) => prev.filter((v) => v.id !== id));
    try {
      const res = await fetch(`/api/admin/verses/${id}`, { method: "DELETE", cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la suppression.");
      }
    } catch (err) {
      setVerses(previous);
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-navy">📖 Trouve le verset</h2>
      <p className="mb-4 text-sm text-gray-500">
        Banque de versets utilisée par le jeu permanent &quot;Trouve le verset&quot; (accessible depuis
        l&apos;accueil). Le mot à deviner est facultatif : sans lui, le verset ne sert qu&apos;à la
        variante &quot;devine la référence&quot;.
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
          <code className="rounded bg-gray-100 px-1">Référence | Texte complet | Mot à deviner (facultatif)</code>
          <br />
          Exemple : <code className="rounded bg-gray-100 px-1">
            Jean 3:16 | Car Dieu a tant aimé le monde... | aimé
          </code>
        </p>
        <textarea
          className="input-field min-h-[140px] font-mono text-xs"
          placeholder={"Jean 3:16 | Car Dieu a tant aimé le monde qu'il a donné son Fils unique... | aimé\nPsaume 23:1 | L'Éternel est mon berger : je ne manquerai de rien."}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
        />
        {bulkResult && <p className="text-sm font-medium text-green-700">{bulkResult}</p>}
        {bulkError && <p className="text-sm font-medium text-red-600">{bulkError}</p>}
        <button
          type="submit"
          disabled={bulkSubmitting || !bulkText.trim()}
          className="btn-accent"
        >
          {bulkSubmitting ? "Import..." : "Importer tout"}
        </button>
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
          Aucun verset enregistré.
        </p>
      ) : (
        <>
          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
          <ul className="space-y-2">
            {verses.map((v) => (
              <li
                key={v.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{v.reference}</p>
                  <p className="text-sm text-gray-600">{v.text}</p>
                  {v.blank_word && (
                    <p className="mt-1 text-xs text-gray-400">
                      Mot à deviner : <span className="font-semibold text-accent-dark">{v.blank_word}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(v.id)}
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
