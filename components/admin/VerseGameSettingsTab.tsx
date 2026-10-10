"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { SiteSettings } from "@/lib/types";

/** Convertit un ISO stocké en base en valeur locale pour un <input type="datetime-local">. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type VerseGameSettings = Pick<
  SiteSettings,
  | "verse_game_enabled"
  | "verse_game_schedule_enabled"
  | "verse_game_schedule_start"
  | "verse_game_schedule_end"
  | "verse_game_timer_enabled"
  | "verse_game_timer_seconds"
>;

const DEFAULTS: VerseGameSettings = {
  verse_game_enabled: true,
  verse_game_schedule_enabled: false,
  verse_game_schedule_start: null,
  verse_game_schedule_end: null,
  verse_game_timer_enabled: false,
  verse_game_timer_seconds: 20,
};

/**
 * Réglages d'activation et de cadrage de « Trouve le verset » — déplacés
 * depuis l'onglet Édition/Apparence (qui ne concerne que l'identité
 * visuelle du site) vers Jeux → Trouve le verset → Réglages.
 *
 * N'envoie au PUT que les champs propres à ce formulaire (jamais l'objet
 * site_settings complet), pour ne jamais écraser une modification faite en
 * parallèle dans l'onglet Apparence.
 */
export default function VerseGameSettingsTab() {
  const toast = useToast();
  const [settings, setSettings] = useState<VerseGameSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Voir SettingsTab : buffer texte libre pour la durée, validé/borné seulement au blur.
  const [timerSecondsText, setTimerSecondsText] = useState("20");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          setSettings(data.settings);
          setTimerSecondsText(String(data.settings.verse_game_timer_seconds ?? 20));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof VerseGameSettings>(key: K, value: VerseGameSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
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

      toast.success("Réglages enregistrés.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Chargement...</p>;
  }

  return (
    <section className="card max-w-xl">
      <h2 className="mb-1 text-lg font-bold text-navy">🎮 Réglages — Trouve le verset</h2>
      <p className="mb-4 text-sm text-gray-500">
        Activation, créneau horaire et chrono par question pour ce jeu.
      </p>

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
                Hors de ce créneau, le jeu affiche un message d&apos;indisponibilité. Laisse un champ vide
                pour ne pas limiter ce côté-là (seulement l&apos;ouverture, ou seulement la fermeture).
              </p>
            </div>
          )}

          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={settings.verse_game_timer_enabled}
                onChange={(e) => updateField("verse_game_timer_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Chrono par question
            </label>
            {settings.verse_game_timer_enabled && (
              <div>
                <label className="label-field" htmlFor="verse_game_timer_seconds">
                  Durée par question (secondes)
                </label>
                <input
                  id="verse_game_timer_seconds"
                  type="number"
                  min={3}
                  max={300}
                  className="input-field text-sm sm:w-32"
                  value={timerSecondsText}
                  onChange={(e) => setTimerSecondsText(e.target.value)}
                  onBlur={() => {
                    const parsed = Math.round(Number(timerSecondsText));
                    const clamped = Number.isFinite(parsed)
                      ? Math.min(300, Math.max(3, parsed))
                      : settings.verse_game_timer_seconds;
                    updateField("verse_game_timer_seconds", clamped);
                    setTimerSecondsText(String(clamped));
                  }}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Passé ce délai, la question est comptée comme fausse et la bonne réponse s&apos;affiche
                  automatiquement.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <button type="button" onClick={handleSave} disabled={saving} className="btn-accent mt-4">
        {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </section>
  );
}
