"use client";

import { useEffect, useState } from "react";
import { MAX_LEVEL } from "@/lib/verse-level";

interface Player {
  deviceKey: string;
  currentLevel: number;
  totalPoints: number;
  updatedAt: string;
  name: string | null;
  email: string | null;
}

const PAGE_SIZE = 50;

export default function VerseGamePlayersTab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [resettingKey, setResettingKey] = useState<string | null>(null);

  useEffect(() => {
    load();
    setEditingKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    fetch(`/api/admin/verse-game/players?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Session expirée. Reconnecte-toi pour voir les joueurs.");
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Erreur lors du chargement des joueurs.");
        }
        setPlayers(data.players ?? []);
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

  function startEdit(p: Player) {
    setEditingKey(p.deviceKey);
    setEditLevel(String(p.currentLevel));
    setEditPoints(String(p.totalPoints));
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingKey) return;

    setEditSubmitting(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/verse-game/players/${encodeURIComponent(editingKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ currentLevel: Number(editLevel), totalPoints: Number(editPoints) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la modification.");
      }
      setPlayers((prev) =>
        prev.map((p) =>
          p.deviceKey === editingKey
            ? { ...p, currentLevel: data.player.current_level, totalPoints: data.player.total_points }
            : p
        )
      );
      setEditingKey(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleReset(deviceKey: string) {
    setResettingKey(deviceKey);
    setError("");
    try {
      const res = await fetch(`/api/admin/verse-game/players/${encodeURIComponent(deviceKey)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la réinitialisation.");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setResettingKey(null);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-navy">🎮 Joueurs de &quot;Trouve le verset&quot;</h2>
      <p className="mb-4 text-sm text-gray-500">
        Tous les appareils ayant déjà joué, avec leur niveau et leurs points cumulés.{" "}
        {total > 0 && <span className="font-semibold text-navy">{total} joueur(s).</span>}
      </p>

      <form onSubmit={handleSearchSubmit} className="mb-3 flex gap-2">
        <input
          className="input-field"
          placeholder="Rechercher par nom ou email..."
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
      ) : error && players.length === 0 ? (
        <div>
          <p className="text-sm font-medium text-red-600">{error}</p>
          {error.includes("Session expirée") && (
            <a href="/admin" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">
              Se reconnecter →
            </a>
          )}
        </div>
      ) : players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          {search ? "Aucun joueur ne correspond à cette recherche." : "Personne n'a encore joué."}
        </p>
      ) : (
        <>
          {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}

          <ul className="space-y-2">
            {players.map((p) =>
              editingKey === p.deviceKey ? (
                <li key={p.deviceKey} className="card space-y-2">
                  <p className="text-sm font-semibold text-navy">
                    {p.name ?? <span className="text-gray-400">Anonyme</span>}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label-field">Niveau (1-{MAX_LEVEL})</label>
                      <input
                        type="number"
                        min={1}
                        max={MAX_LEVEL}
                        className="input-field"
                        value={editLevel}
                        onChange={(e) => setEditLevel(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-field">Points cumulés</label>
                      <input
                        type="number"
                        min={0}
                        className="input-field"
                        value={editPoints}
                        onChange={(e) => setEditPoints(e.target.value)}
                      />
                    </div>
                  </div>
                  {editError && <p className="text-sm font-medium text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={editSubmitting}
                      className="btn-accent"
                    >
                      {editSubmitting ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={p.deviceKey}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">
                      {p.name ?? <span className="italic text-gray-400">Anonyme (jamais identifié)</span>}
                    </p>
                    {p.email && <p className="text-xs text-gray-500">{p.email}</p>}
                    <p className="mt-1 text-sm text-gray-600">
                      Niveau <span className="font-semibold text-navy">{p.currentLevel}</span> ·{" "}
                      <span className="font-semibold text-accent-dark">{p.totalPoints} points</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-gray-50"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReset(p.deviceKey)}
                      disabled={resettingKey === p.deviceKey}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {resettingKey === p.deviceKey ? "..." : "Réinitialiser"}
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
