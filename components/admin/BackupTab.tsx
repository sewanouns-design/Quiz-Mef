"use client";

import { useRef, useState } from "react";

interface BackupPayload {
  type: "full" | "period";
  exportedAt: string;
  range: { from: string | null; to: string | null };
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
}

function totalCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

async function downloadBackup(url: string, filenameFallback: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Erreur lors de la sauvegarde.");
  }
  const text = await res.text();
  const blob = new Blob([text], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filenameFallback;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export default function BackupTab() {
  const [exportingFull, setExportingFull] = useState(false);
  const [exportingPeriod, setExportingPeriod] = useState(false);
  const [exportError, setExportError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [pendingFile, setPendingFile] = useState<BackupPayload | null>(null);
  const [pendingFileName, setPendingFileName] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreResult, setRestoreResult] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExportFull() {
    setExportError("");
    setExportingFull(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await downloadBackup(
        "/api/admin/backup/export",
        `quiz-mef-sauvegarde-complete-${today}.json`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setExportingFull(false);
    }
  }

  async function handleExportPeriod() {
    if (!from && !to) {
      setExportError("Choisis au moins une date de début ou de fin.");
      return;
    }
    setExportError("");
    setExportingPeriod(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      const today = new Date().toISOString().slice(0, 10);
      await downloadBackup(
        `/api/admin/backup/export?${params.toString()}`,
        `quiz-mef-sauvegarde-periode-${today}.json`
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setExportingPeriod(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setRestoreError("");
    setRestoreResult(null);
    setPendingFile(null);
    setPendingFileName("");
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupPayload;
        if (!parsed.tables || typeof parsed.tables !== "object") {
          throw new Error("Ce fichier ne ressemble pas à une sauvegarde valide.");
        }
        setPendingFile(parsed);
        setPendingFileName(file.name);
      } catch {
        setRestoreError("Ce fichier n'est pas une sauvegarde JSON valide.");
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    setRestoreError("");
    try {
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ tables: pendingFile.tables }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la restauration.");
      }
      setRestoreResult(data.restored);
      setPendingFile(null);
      setPendingFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setRestoring(false);
    }
  }

  function handleCancelRestore() {
    setPendingFile(null);
    setPendingFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-bold text-navy">💾 Sauvegarde complète</h2>
        <p className="mt-1 text-sm text-gray-500">
          Télécharge toutes les données du site (participants, quiz, questions, soumissions,
          réponses, questions sur la leçon, suggestions, journal admin) depuis le tout premier
          enregistrement jusqu&apos;au plus récent, dans un fichier JSON lisible et bien
          structuré. À garder précieusement, et à refaire régulièrement — c&apos;est ce fichier
          qui permet de tout restaurer en cas d&apos;incident.
        </p>
        <button
          onClick={handleExportFull}
          disabled={exportingFull}
          className="btn-primary mt-4"
        >
          {exportingFull ? "Préparation..." : "⬇️ Télécharger la sauvegarde complète"}
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-navy">📅 Export par période</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pour consulter ou analyser une période précise. Les quiz et questions restent
          complets pour garder le contexte ; seules les données datées (inscriptions,
          soumissions, questions, suggestions) sont filtrées. Cet export est pour la
          consultation — ce n&apos;est pas lui qu&apos;il faut utiliser comme sauvegarde de
          secours.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label-field" htmlFor="backup-from">
              Du
            </label>
            <input
              id="backup-from"
              type="date"
              className="input-field"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field" htmlFor="backup-to">
              Au
            </label>
            <input
              id="backup-to"
              type="date"
              className="input-field"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            onClick={handleExportPeriod}
            disabled={exportingPeriod}
            className="btn-secondary"
          >
            {exportingPeriod ? "Préparation..." : "⬇️ Télécharger cette période"}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm font-medium text-red-600">{exportError}</p>}

      <div className="card">
        <h2 className="text-lg font-bold text-navy">♻️ Restaurer une sauvegarde</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choisis un fichier de sauvegarde précédemment téléchargé. La restauration ajoute et
          met à jour les données du fichier dans la base ; elle ne supprime jamais rien de ce
          qui existe déjà.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileSelected}
          className="mt-3 block w-full text-sm text-gray-600"
        />

        {restoreError && <p className="mt-3 text-sm font-medium text-red-600">{restoreError}</p>}

        {pendingFile && (
          <div className="mt-4 rounded-xl border-2 border-accent bg-accent/5 p-4">
            <p className="text-sm font-semibold text-navy">
              Fichier « {pendingFileName} » — {pendingFile.type === "full" ? "sauvegarde complète" : "export par période"},
              exportée le {new Date(pendingFile.exportedAt).toLocaleString("fr-FR")}.
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-gray-600 sm:grid-cols-3">
              {Object.entries(pendingFile.counts).map(([table, count]) => (
                <li key={table}>
                  {table} : <strong>{count}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium text-accent-dark">
              Total : {totalCount(pendingFile.counts)} ligne(s) à restaurer.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="btn-accent"
              >
                {restoring ? "Restauration..." : "Confirmer la restauration"}
              </button>
              <button onClick={handleCancelRestore} disabled={restoring} className="btn-secondary">
                Annuler
              </button>
            </div>
          </div>
        )}

        {restoreResult && (
          <div className="mt-4 rounded-xl border-2 border-green-500 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">✅ Restauration terminée.</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-gray-600 sm:grid-cols-3">
              {Object.entries(restoreResult).map(([table, count]) => (
                <li key={table}>
                  {table} : <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
