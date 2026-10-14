"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { requestPushSubscription } from "@/lib/push-client";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";
import type { SiteSettings } from "@/lib/types";

type Summary = {
  activeSubscriptions: number;
  subscribedParticipants: number;
  anonymousSubscriptions: number;
  newSubscriptions7d: number;
  newSubscriptions30d: number;
  notificationsSent30d: number;
  notificationsTargeted30d: number;
  dispatches30d: number;
};

type SubscriptionRow = {
  id: string;
  participantName: string;
  participantEmail: string | null;
  endpoint: string;
  createdAt: string;
};

type HistoryRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  removedCount: number;
  createdAt: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-navy" : "bg-gray-200"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function StatCard({ icon, label, value, detail }: { icon: string; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">{icon}</span>
      </div>
    </div>
  );
}

export default function PushNotificationsTab() {
  const toast = useToast();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, pushResponse] = await Promise.all([
        fetch("/api/admin/settings", { cache: "no-store" }),
        fetch("/api/admin/push", { cache: "no-store" }),
      ]);
      const settingsData = await settingsResponse.json().catch(() => ({}));
      const pushData = await pushResponse.json().catch(() => ({}));
      if (!settingsResponse.ok) throw new Error(settingsData.error || "Impossible de charger les réglages.");
      if (!pushResponse.ok) throw new Error(pushData.error || "Impossible de charger les abonnements push.");
      setSettings(settingsData.settings ?? DEFAULT_SITE_SETTINGS);
      setSummary(pushData.summary ?? null);
      setSubscriptions(pushData.subscriptions ?? []);
      setHistory(pushData.history ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setPushSetting(key: "notify_push_new_quiz" | "notify_push_new_update" | "notify_push_verse_game_reopened", value: boolean) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          notify_push_new_quiz: settings.notify_push_new_quiz,
          notify_push_new_update: settings.notify_push_new_update,
          notify_push_verse_game_reopened: settings.notify_push_verse_game_reopened,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer les réglages push.");
      setSettings(data.settings ?? settings);
      toast.success("Réglages des notifications enregistrés.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function activatePrivateAlerts() {
    setActivating(true);
    const result = await requestPushSubscription();
    setActivating(false);
    if (result === "subscribed") {
      toast.success("Les notifications de cet appareil sont activées.");
      await load();
    } else if (result === "denied") {
      toast.error("Les notifications sont bloquées par le navigateur.");
    } else {
      toast.error("Impossible d’activer les notifications sur cet appareil.");
    }
  }

  if (loading) return <p className="text-gray-500">Chargement des notifications push...</p>;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">🔔</span>
          <div>
            <h2 className="text-xl font-extrabold text-navy">Notifications push</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Contrôle les notifications envoyées aux visiteurs et participants abonnés. Un abonnement correspond à un navigateur ou à un appareil ; une même personne peut donc avoir plusieurs abonnements.
            </p>
          </div>
        </div>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="📱" label="Abonnements actifs" value={`${summary?.activeSubscriptions ?? 0}`} detail="appareils pouvant recevoir" />
        <StatCard icon="👥" label="Participants abonnés" value={`${summary?.subscribedParticipants ?? 0}`} detail="personnes identifiées" />
        <StatCard icon="🔔" label="Prochaine diffusion" value={`${summary?.activeSubscriptions ?? 0}`} detail="abonnements ciblés" />
        <StatCard icon="📨" label="Envoyées — 30 jours" value={`${summary?.notificationsSent30d ?? 0}`} detail={`${summary?.dispatches30d ?? 0} diffusion(s)`} />
      </div>

      <section className="rounded-2xl border border-blue-100 bg-[#edf9f6] p-5">
        <h3 className="text-lg font-extrabold text-navy">⚠️ Alerte privée d’automatisation</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Active les notifications sur cet appareil pour recevoir les alertes techniques et les informations importantes de l’administration. Cela ne modifie pas les notifications envoyées aux visiteurs.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" onClick={activatePrivateAlerts} disabled={activating} className="rounded-full border-2 border-navy bg-white px-5 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-navy hover:text-white disabled:opacity-50">
            {activating ? "Activation..." : "Activer les notifications sur cet appareil"}
          </button>
          <span className="text-sm font-medium text-gray-500">{summary?.activeSubscriptions ?? 0} appareil(s) configuré(s)</span>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-extrabold text-navy">Événements qui déclenchent une notification</h3>
        <p className="mt-1 text-sm leading-6 text-gray-500">Les changements sont enregistrés uniquement après avoir cliqué sur « Enregistrer ».</p>
        <div className="mt-4 divide-y divide-gray-100">
          <div className="flex items-start justify-between gap-4 py-4">
            <div><p className="font-bold text-gray-900">Nouveau quiz publié</p><p className="mt-1 text-sm text-gray-500">Dès qu’un quiz du jour ou hebdomadaire est activé.</p><span className="mt-3 inline-block rounded-full bg-[#e8f6f3] px-3 py-1 text-xs text-gray-600">« Nouveau quiz disponible »</span></div>
            <Toggle checked={settings.notify_push_new_quiz} onChange={(value) => setPushSetting("notify_push_new_quiz", value)} />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div><p className="font-bold text-gray-900">Nouveauté publiée</p><p className="mt-1 text-sm text-gray-500">Lorsqu’une nouveauté est ajoutée dans l’onglet « Nouveautés ».</p><span className="mt-3 inline-block rounded-full bg-[#e8f6f3] px-3 py-1 text-xs text-gray-600">« Nouveauté sur le site »</span></div>
            <Toggle checked={settings.notify_push_new_update} onChange={(value) => setPushSetting("notify_push_new_update", value)} />
          </div>
          <div className="flex items-start justify-between gap-4 py-4">
            <div><p className="font-bold text-gray-900">Jeu « Trouve le verset » réactivé</p><p className="mt-1 text-sm text-gray-500">Quand le jeu redevient jouable après avoir été fermé.</p><span className="mt-3 inline-block rounded-full bg-[#e8f6f3] px-3 py-1 text-xs text-gray-600">« Le jeu est de retour »</span></div>
            <Toggle checked={settings.notify_push_verse_game_reopened} onChange={(value) => setPushSetting("notify_push_verse_game_reopened", value)} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-[#e8f6f3] px-4 py-2 text-sm font-semibold text-gray-700">{summary?.activeSubscriptions ?? 0} abonnements recevront la prochaine notification.</span>
          <button type="button" onClick={save} disabled={saving} className="rounded-full bg-navy px-7 py-3 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50">{saving ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold text-navy">Abonnements récents</h3><p className="mt-1 text-sm text-gray-500">{summary?.newSubscriptions7d ?? 0} nouveau(x) depuis 7 jours · {summary?.newSubscriptions30d ?? 0} depuis 30 jours</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-navy">{summary?.anonymousSubscriptions ?? 0} anonyme(s)</span></div>
          <div className="mt-4 divide-y divide-gray-100">{subscriptions.length === 0 ? <p className="py-5 text-sm text-gray-400">Aucun abonnement enregistré.</p> : subscriptions.slice(0, 12).map((subscription) => <div key={subscription.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-700">{subscription.participantName}</p><p className="truncate text-xs text-gray-400">{subscription.endpoint}</p></div><time className="shrink-0 text-xs text-gray-400">{formatDate(subscription.createdAt)}</time></div>)}</div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-extrabold text-navy">Historique des diffusions</h3>
          <p className="mt-1 text-sm text-gray-500">Nombre ciblé, envoyé et retiré automatiquement.</p>
          <div className="mt-4 divide-y divide-gray-100">{history.length === 0 ? <p className="py-5 text-sm text-gray-400">Aucune diffusion journalisée pour le moment.</p> : history.slice(0, 10).map((entry) => <div key={entry.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-gray-700">{entry.title}</p><time className="shrink-0 text-xs text-gray-400">{formatDate(entry.createdAt)}</time></div><p className="mt-1 text-xs text-gray-500">{entry.sentCount} envoyé(s) sur {entry.targetCount} ciblé(s) · {entry.failedCount} échec(s) · {entry.removedCount} retiré(s)</p></div>)}</div>
        </section>
      </div>
    </div>
  );
}
