"use client";

import { useEffect, useState } from "react";

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperInstance;
  }
}

export default function ColorPickerInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false);

  useEffect(() => {
    setSupportsEyeDropper(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  async function handlePickColor() {
    if (!window.EyeDropper) return;
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
    } catch {
      // L'utilisateur a annulé la sélection.
    }
  }

  return (
    <div>
      <label className="label-field">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
          aria-label={`Sélecteur de couleur pour ${label}`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field font-mono text-sm"
          placeholder="#000000"
        />
        {supportsEyeDropper && (
          <button
            type="button"
            onClick={handlePickColor}
            title="Choisir une couleur n'importe où sur l'écran"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg transition-colors hover:bg-gray-50"
          >
            🎨
          </button>
        )}
      </div>
    </div>
  );
}
