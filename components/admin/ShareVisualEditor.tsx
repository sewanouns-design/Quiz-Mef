"use client";

import { useRef, useState } from "react";
import { interpolateShareText, type ShareTextLayer, type ShareVisualConfig, type ShareVisualMode } from "@/lib/result-share";

const MAX_BACKGROUND_BYTES = 1_500 * 1024;

const DAILY_PREVIEW_VALUES = {
  participantName: "Franck A.",
  quizTitle: "Marchons dans la voie de Dieu",
  score: 20,
  maxScore: 20,
  siteName: "Quiz Biblique MEF",
  quarterLabel: "",
  rank: "",
  rankLabel: "",
  examScore: "",
  pedagogicalAverage: "",
  finalScore: "",
  prize: "",
};

const QUARTERLY_PREVIEW_VALUES = {
  participantName: "Franck A.",
  quizTitle: "Examen trimestriel",
  score: 20,
  maxScore: 20,
  siteName: "Quiz Biblique MEF",
  quarterLabel: "Septembre – Novembre 2026",
  rank: 1,
  rankLabel: "1er prix",
  examScore: 19,
  pedagogicalAverage: 18.4,
  finalScore: 37.4,
  prize: "Récompense à définir",
};

interface ShareVisualEditorProps {
  mode: ShareVisualMode;
  config: ShareVisualConfig;
  onChange: (config: ShareVisualConfig) => void;
}

function updateLayer(config: ShareVisualConfig, id: string, patch: Partial<ShareTextLayer>): ShareVisualConfig {
  return { ...config, layers: config.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) };
}

export default function ShareVisualEditor({ mode, config, onChange }: ShareVisualEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const previewValues = mode === "quarterly" ? QUARTERLY_PREVIEW_VALUES : DAILY_PREVIEW_VALUES;

  function uploadBackground(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Le fond doit être une image PNG, JPG ou WebP.");
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      setError("Le fond doit faire moins de 1,5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ ...config, background: String(reader.result) });
    reader.onerror = () => setError("Impossible de lire cette image.");
    reader.readAsDataURL(file);
  }

  function addLayer() {
    const id = `layer-${Date.now()}`;
    onChange({
      ...config,
      layers: [
        ...config.layers,
        { id, text: "Mon texte", x: 50, y: 50, maxWidth: 85, fontSize: 28, color: "#ffffff", fontWeight: 600, align: "center", visible: true },
      ],
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-navy">{mode === "daily" ? "Visuel — Quiz quotidien" : "Visuel — Gagnants trimestriels"}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500">
            {mode === "daily"
              ? "Ce visuel accompagne le résultat partagé par un participant après un quiz du jour ou hebdomadaire."
              : "Ce visuel présente le gagnant du concours trimestriel comme une distinction, sans afficher le mot certificat."}
          </p>
        </div>
        <button type="button" onClick={() => onChange({ ...config, layers: config.layers.map((layer) => ({ ...layer })) })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          Dupliquer la configuration
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div>
          <div
            className="relative mx-auto aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-2xl border border-gray-200 bg-cover bg-center shadow-inner"
            style={{
              backgroundImage: config.background
                ? `url(${config.background})`
                : config.backgroundStyle === "plain"
                  ? "linear-gradient(145deg,#f7f6f2,#e5e7eb)"
                  : config.backgroundStyle === "classic"
                    ? "linear-gradient(145deg,#14213d,#0a1428)"
                    : "linear-gradient(145deg,#142f63 5%,#132a59 55%,#49213f)",
            }}
          >
            {!config.background && config.backgroundStyle === "celebration" && <div className="absolute left-1/2 top-[14%] -translate-x-1/2 text-4xl">🎉</div>}
            {config.layers.filter((layer) => layer.visible).map((layer) => {
              const text = interpolateShareText(layer.text, previewValues);
              if (!text) return null;
              return (
                <div
                  key={layer.id}
                  className="absolute leading-tight"
                  style={{
                    left: `${layer.x}%`,
                    top: `${layer.y}%`,
                    width: `${layer.maxWidth}%`,
                    transform: `translateX(${layer.align === "left" ? "0" : layer.align === "right" ? "-100%" : "-50%"})`,
                    color: layer.color,
                    fontSize: `${Math.max(8, layer.fontSize / 4)}px`,
                    fontWeight: layer.fontWeight,
                    textAlign: layer.align,
                    textShadow: config.backgroundStyle === "plain" ? "0 1px 3px rgba(0,0,0,.15)" : "0 1px 5px rgba(0,0,0,.35)",
                  }}
                >
                  {text}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">Aperçu avec des données fictives</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label-field">Fond du visuel</label>
            <div className="flex flex-wrap gap-2">
              {(["celebration", "classic", "plain"] as const).map((style) => (
                <button key={style} type="button" onClick={() => onChange({ ...config, backgroundStyle: style })} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${config.backgroundStyle === style ? "border-navy bg-blue-50 text-navy" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {style === "celebration" ? "Fond chic" : style === "classic" ? "Fond classique" : "Fond clair"}
                </button>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border-2 border-dashed border-navy px-3 py-2 text-xs font-semibold text-navy hover:bg-blue-50">
                Importer un fond
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadBackground} className="hidden" />
              {config.background && <button type="button" onClick={() => onChange({ ...config, background: null })} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Retirer le fond importé</button>}
            </div>
            {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          </div>

          <div className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            Variables disponibles : <code>{"{{participantName}}"}</code>, <code>{"{{quizTitle}}"}</code>, <code>{"{{score}}"}</code>, <code>{"{{maxScore}}"}</code>, <code>{"{{siteName}}"}</code>, <code>{"{{rankLabel}}"}</code>, <code>{"{{quarterLabel}}"}</code>, <code>{"{{examScore}}"}</code>, <code>{"{{pedagogicalAverage}}"}</code>, <code>{"{{finalScore}}"}</code> et <code>{"{{prize}}"}</code>.
          </div>

          <div className="space-y-3">
            {config.layers.map((layer, index) => (
              <div key={layer.id} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-navy">
                    <input type="checkbox" checked={layer.visible} onChange={(e) => onChange(updateLayer(config, layer.id, { visible: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
                    <span>Calque {index + 1}</span>
                  </label>
                  <button type="button" onClick={() => onChange({ ...config, layers: config.layers.filter((candidate) => candidate.id !== layer.id) })} className="text-xs font-semibold text-red-600 hover:underline">Supprimer</button>
                </div>
                <textarea value={layer.text} onChange={(e) => onChange(updateLayer(config, layer.id, { text: e.target.value }))} className="input-field min-h-[50px] text-sm" placeholder="Texte ou variable automatique" />
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <label className="text-[11px] text-gray-500">X %<input type="number" min={0} max={100} value={layer.x} onChange={(e) => onChange(updateLayer(config, layer.id, { x: Number(e.target.value) }))} className="input-field mt-1 text-xs" /></label>
                  <label className="text-[11px] text-gray-500">Y %<input type="number" min={0} max={100} value={layer.y} onChange={(e) => onChange(updateLayer(config, layer.id, { y: Number(e.target.value) }))} className="input-field mt-1 text-xs" /></label>
                  <label className="text-[11px] text-gray-500">Taille<input type="number" min={10} max={160} value={layer.fontSize} onChange={(e) => onChange(updateLayer(config, layer.id, { fontSize: Number(e.target.value) }))} className="input-field mt-1 text-xs" /></label>
                  <label className="text-[11px] text-gray-500">Largeur %<input type="number" min={10} max={100} value={layer.maxWidth} onChange={(e) => onChange(updateLayer(config, layer.id, { maxWidth: Number(e.target.value) }))} className="input-field mt-1 text-xs" /></label>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <label className="text-[11px] text-gray-500">Couleur<input type="color" value={layer.color} onChange={(e) => onChange(updateLayer(config, layer.id, { color: e.target.value }))} className="mt-1 h-9 w-full cursor-pointer rounded border border-gray-200 bg-white p-1" /></label>
                  <label className="text-[11px] text-gray-500">Graisse<select value={layer.fontWeight} onChange={(e) => onChange(updateLayer(config, layer.id, { fontWeight: Number(e.target.value) }))} className="input-field mt-1 text-xs"><option value={500}>Normale</option><option value={600}>Semi-gras</option><option value={700}>Gras</option><option value={900}>Très gras</option></select></label>
                  <label className="text-[11px] text-gray-500">Alignement<select value={layer.align} onChange={(e) => onChange(updateLayer(config, layer.id, { align: e.target.value as ShareTextLayer["align"] }))} className="input-field mt-1 text-xs"><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLayer} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-navy hover:bg-gray-50">+ Ajouter un texte</button>
        </div>
      </div>
    </div>
  );
}
