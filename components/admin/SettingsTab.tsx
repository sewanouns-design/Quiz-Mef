"use client";

import { useEffect, useRef, useState } from "react";
import ColorPickerInput from "./ColorPickerInput";
import HomePreview from "./HomePreview";
import LogoIcon, { isImageLogo } from "@/components/LogoIcon";
import {
  DEFAULT_SITE_SETTINGS,
  FONT_OPTIONS,
  TEMPLATE_OPTIONS,
  TEXT_SIZE_OPTIONS,
  shadeHexColor,
} from "@/lib/site-settings";
import type { HomeStep, SiteSettings } from "@/lib/types";

const MAX_LOGO_FILE_BYTES = 250 * 1024;

/** Convertit un ISO stocké en base en valeur locale pour un <input type="datetime-local">. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsTab() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLogoError("");
    if (!file.type.startsWith("image/")) {
      setLogoError("Le fichier doit être une image.");
      return;
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      setLogoError("L'image doit faire moins de 250 Ko.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateField("logo_icon", String(reader.result));
    reader.onerror = () => setLogoError("Impossible de lire ce fichier.");
    reader.readAsDataURL(file);
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

  function updateSecondaryColor(hex: string) {
    setSettings((prev) => ({
      ...prev,
      color_secondary: hex,
      color_secondary_light: shadeHexColor(hex, 40),
      color_secondary_dark: shadeHexColor(hex, -40),
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
        <div className="mb-6">
          <p className="label-field">Couleurs du site</p>
          <div className="grid gap-4 sm:grid-cols-2">
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
            <ColorPickerInput
              label="Couleur secondaire"
              value={settings.color_secondary}
              onChange={updateSecondaryColor}
            />
            <ColorPickerInput
              label="Couleur de fond"
              value={settings.color_background}
              onChange={(hex) => updateField("color_background", hex)}
            />
            <ColorPickerInput
              label="Couleur du texte"
              value={settings.color_text}
              onChange={(hex) => updateField("color_text", hex)}
            />
          </div>
        </div>

        {/* Taille du texte */}
        <div className="mb-6">
          <label className="label-field">Taille du titre et du sous-titre</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {TEXT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField("text_size", option.value)}
                className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  settings.text_size === option.value
                    ? "border-current"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
                style={
                  settings.text_size === option.value
                    ? { borderColor: settings.color_accent, color: settings.color_primary }
                    : undefined
                }
              >
                {option.label}
              </button>
            ))}
          </div>
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

        {/* Nom du site */}
        <div className="mb-6">
          <label className="label-field" htmlFor="site_name">
            Nom du site (affiché dans l&apos;entête de chaque page)
          </label>
          <input
            id="site_name"
            className="input-field"
            value={settings.site_name}
            onChange={(e) => updateField("site_name", e.target.value)}
          />
        </div>

        {/* Logo */}
        <div className="mb-6">
          <label className="label-field">Logo / icône du site</label>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-2xl">
              <LogoIcon value={settings.logo_icon} className="h-10 w-10" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg border-2 border-navy px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
                >
                  📤 Importer une image
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <input
                  type="text"
                  value={isImageLogo(settings.logo_icon) ? "" : settings.logo_icon}
                  onChange={(e) => updateField("logo_icon", e.target.value)}
                  placeholder="ou un emoji, ex : ⁉️"
                  className="input-field w-40 text-sm"
                  maxLength={4}
                />
              </div>
              {logoError && <p className="mt-1 text-xs font-medium text-red-600">{logoError}</p>}
              <p className="mt-1 text-xs text-gray-400">PNG, JPG ou SVG, 250 Ko maximum.</p>
            </div>
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
          <p className="text-xs text-gray-400">
            Le verset affiché change automatiquement à chaque visite, tiré
            aléatoirement d&apos;une sélection de versets encourageants.
          </p>
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
          <div>
            <label className="label-field" htmlFor="about_text">
              Texte de la page &quot;À propos&quot; (menu du site)
            </label>
            <textarea
              id="about_text"
              className="input-field min-h-[100px]"
              value={settings.about_text}
              onChange={(e) => updateField("about_text", e.target.value)}
            />
          </div>
          <div>
            <label className="label-field" htmlFor="start_button_text">
              Texte du bouton pour commencer le quiz
            </label>
            <input
              id="start_button_text"
              className="input-field"
              value={settings.start_button_text}
              onChange={(e) => updateField("start_button_text", e.target.value)}
            />
          </div>
          <div>
            <label className="label-field" htmlFor="activity_ticker_phrase">
              Phrase du bandeau d&apos;activité
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">« Prénom »</span>
              <input
                id="activity_ticker_phrase"
                className="input-field"
                value={settings.activity_ticker_phrase}
                onChange={(e) => updateField("activity_ticker_phrase", e.target.value)}
              />
              <span className="text-sm text-gray-400">« titre du quiz »</span>
            </div>
          </div>
          <div>
            <label className="label-field" htmlFor="returning_greeting">
              Accueil personnalisé (appareil déjà reconnu)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="returning_greeting"
                className="input-field"
                value={settings.returning_greeting}
                onChange={(e) => updateField("returning_greeting", e.target.value)}
              />
              <span className="text-sm text-gray-400">, « Prénom »</span>
            </div>
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
        <div className="mb-6">
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-navy">
            <input
              type="checkbox"
              checked={settings.show_stats}
              onChange={(e) => updateField("show_stats", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Afficher les statistiques (participants, quiz complétés...)
          </label>
          {settings.show_stats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label-field" htmlFor="stat_label_participants">
                  Libellé « participants »
                </label>
                <input
                  id="stat_label_participants"
                  className="input-field text-sm"
                  value={settings.stat_label_participants}
                  onChange={(e) => updateField("stat_label_participants", e.target.value)}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="stat_label_quizzes">
                  Libellé « quiz créés »
                </label>
                <input
                  id="stat_label_quizzes"
                  className="input-field text-sm"
                  value={settings.stat_label_quizzes}
                  onChange={(e) => updateField("stat_label_quizzes", e.target.value)}
                />
              </div>
              <div>
                <label className="label-field" htmlFor="stat_label_submissions">
                  Libellé « quiz complétés »
                </label>
                <input
                  id="stat_label_submissions"
                  className="input-field text-sm"
                  value={settings.stat_label_submissions}
                  onChange={(e) => updateField("stat_label_submissions", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Trouve le verset : activation + créneau horaire */}
        <div className="mb-6 rounded-xl border border-gray-200 p-4">
          <h3 className="mb-3 text-sm font-bold text-navy">🎮 Jeu « Trouve le verset »</h3>
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-navy">
            <input
              type="checkbox"
              checked={settings.verse_game_enabled}
              onChange={(e) => updateField("verse_game_enabled", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Activer le jeu (visible et jouable sur le site)
          </label>

          {settings.verse_game_enabled && (
            <>
              <label className="mb-3 flex items-center gap-2 text-sm font-medium text-navy">
                <input
                  type="checkbox"
                  checked={settings.verse_game_schedule_enabled}
                  onChange={(e) => updateField("verse_game_schedule_enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Limiter à un créneau horaire
              </label>

              {settings.verse_game_schedule_enabled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-field" htmlFor="verse_game_schedule_start">
                      Ouverture
                    </label>
                    <input
                      id="verse_game_schedule_start"
                      type="datetime-local"
                      className="input-field text-sm"
                      value={toDatetimeLocalValue(settings.verse_game_schedule_start)}
                      onChange={(e) =>
                        updateField(
                          "verse_game_schedule_start",
                          e.target.value ? new Date(e.target.value).toISOString() : null
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="label-field" htmlFor="verse_game_schedule_end">
                      Fermeture
                    </label>
                    <input
                      id="verse_game_schedule_end"
                      type="datetime-local"
                      className="input-field text-sm"
                      value={toDatetimeLocalValue(settings.verse_game_schedule_end)}
                      onChange={(e) =>
                        updateField(
                          "verse_game_schedule_end",
                          e.target.value ? new Date(e.target.value).toISOString() : null
                        )
                      }
                    />
                  </div>
                  <p className="col-span-full text-xs text-gray-400">
                    Hors de ce créneau, le jeu affiche un message d&apos;indisponibilité. Laisse un champ
                    vide pour ne pas limiter ce côté-là (seulement l&apos;ouverture, ou seulement la
                    fermeture).
                  </p>
                </div>
              )}
            </>
          )}
        </div>

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
