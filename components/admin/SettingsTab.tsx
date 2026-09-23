"use client";

import { useEffect, useState } from "react";
import ColorPickerInput from "./ColorPickerInput";
import HomePreview from "./HomePreview";
import {
  DEFAULT_SITE_SETTINGS,
  FONT_OPTIONS,
  ICON_OPTIONS,
  TEMPLATE_OPTIONS,
  shadeHexColor,
} from "@/lib/site-settings";
import type { HomeStep, SiteSettings } from "@/lib/types";

export default function SettingsTab() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updatePrimaryColor(hex: string) {
    setSettings((prev) => ({
      ...prev,
      color_primary: hex,
      color_primary_light: shadeHexColor(hex, 40),
      color_primary_dark: shadeHexColor(hex, -40),
    }));
  }

  function updateAccentColor(hex: string) {
    setSettings((prev) => ({
      ...prev,
      color_accent: hex,
      color_accent_light: shadeHexColor(hex, 40),
      color_accent_dark: shadeHexColor(hex, -40),
    }));
  }

  function updateStep(index: number, field: keyof HomeStep, value: string) {
    setSettings((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    }));
  }

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'enregistrement.");
      }

      setSuccess("Personnalisation enregistrée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: settings.color_primary }}>
            Personnalisation de la page d&apos;accueil
          </h2>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold hover:underline"
            style={{ color: settings.color_accent_dark }}
          >
            Voir la page en ligne ↗
          </a>
        </div>

        {/* Template */}
        <div className="mb-6">
          <label className="label-field">Design de la page d&apos;accueil</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField("template", option.value)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  settings.template === option.value
                    ? "border-current"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={
                  settings.template === option.value
                    ? { borderColor: settings.color_accent, color: settings.color_primary }
                    : undefined
                }
              >
                <p className="font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-gray-500">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Couleurs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <ColorPickerInput
            label="Couleur principale"
            value={settings.color_primary}
            onChange={updatePrimaryColor}
          />
          <ColorPickerInput
            label="Couleur d'accent"
            value={settings.color_accent}
            onChange={updateAccentColor}
          />
        </div>

        {/* Police */}
        <div className="mb-6">
          <label className="label-field" htmlFor="font_family">
            Police
          </label>
          <select
            id="font_family"
            className="input-field"
            value={settings.font_family}
            onChange={(e) => updateField("font_family", e.target.value)}
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        {/* Icône logo */}
        <div className="mb-6">
          <label className="label-field">Icône du logo</label>
          <div className="flex flex-wrap items-center gap-2">
            {ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => updateField("logo_icon", icon)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition-colors ${
                  settings.logo_icon === icon ? "" : "border-gray-200 hover:border-gray-300"
                }`}
                style={settings.logo_icon === icon ? { borderColor: settings.color_accent } : undefined}
              >
                {icon}
              </button>
            ))}
            <input
              type="text"
              value={settings.logo_icon}
              onChange={(e) => updateField("logo_icon", e.target.value)}
              className="input-field w-20 text-center"
              maxLength={4}
            />
          </div>
        </div>

        {/* Textes */}
        <div className="mb-6 grid gap-4">
          <div>
            <label className="label-field" htmlFor="hero_title">
              Titre principal
            </label>
            <input
              id="hero_title"
              className="input-field"
              value={settings.hero_title}
              onChange={(e) => updateField("hero_title", e.target.value)}
            />
          </div>
          <div>
            <label className="label-field" htmlFor="hero_subtitle">
              Sous-titre
            </label>
            <input
              id="hero_subtitle"
              className="input-field"
              value={settings.hero_subtitle}
              onChange={(e) => updateField("hero_subtitle", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="verse_text">
                Verset (texte)
              </label>
              <textarea
                id="verse_text"
                className="input-field min-h-[80px]"
                value={settings.verse_text}
                onChange={(e) => updateField("verse_text", e.target.value)}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="verse_reference">
                Verset (référence)
              </label>
              <input
                id="verse_reference"
                className="input-field"
                value={settings.verse_reference}
                onChange={(e) => updateField("verse_reference", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label-field" htmlFor="footer_text">
              Texte de pied de page
            </label>
            <input
              id="footer_text"
              className="input-field"
              value={settings.footer_text}
              onChange={(e) => updateField("footer_text", e.target.value)}
            />
          </div>
        </div>

        {/* Étapes (template "Complet" uniquement) */}
        {settings.template === "steps" && (
          <div className="mb-6">
            <label className="label-field">Étapes &quot;Comment ça marche&quot;</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {settings.steps.map((step, index) => (
                <div key={index} className="rounded-xl border border-gray-200 p-3">
                  <input
                    value={step.icon}
                    onChange={(e) => updateStep(index, "icon", e.target.value)}
                    className="input-field mb-2 w-16 text-center"
                    maxLength={4}
                  />
                  <input
                    value={step.title}
                    onChange={(e) => updateStep(index, "title", e.target.value)}
                    className="input-field mb-2 text-sm font-semibold"
                    placeholder="Titre de l'étape"
                  />
                  <textarea
                    value={step.description}
                    onChange={(e) => updateStep(index, "description", e.target.value)}
                    className="input-field min-h-[70px] text-xs"
                    placeholder="Description"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistiques */}
        <label className="mb-6 flex items-center gap-2 text-sm font-medium text-navy">
          <input
            type="checkbox"
            checked={settings.show_stats}
            onChange={(e) => updateField("show_stats", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Afficher les statistiques (participants, quiz complétés...)
        </label>

        {error && <p className="mb-4 text-sm font-medium text-red-600">{error}</p>}
        {success && <p className="mb-4 text-sm font-medium text-green-600">{success}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: settings.color_primary }}
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </section>

      <HomePreview settings={settings} />
    </div>
  );
}
