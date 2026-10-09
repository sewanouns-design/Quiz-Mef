"use client";

import { useEffect, useState } from "react";
import type { SiteUpdate } from "@/lib/types";

const SEEN_STORAGE_KEY = "mef_last_seen_update";

/**
 * Pop-up fermable "coup de projecteur" sur la DERNIÈRE nouveauté pas encore
 * vue sur cet appareil (comparé à son id, en localStorage) — une seule à la
 * fois, en grand, plutôt qu'une liste. Fermer le pop-up le fait disparaître
 * DÉFINITIVEMENT pour cette nouveauté (et les plus anciennes) ; il ne revient
 * que lorsque l'admin en publie une plus récente.
 */
export default function NewsPopup() {
  const [update, setUpdate] = useState<SiteUpdate | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/site-updates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const all: SiteUpdate[] = data.updates ?? [];
        const latest = all[0];
        if (!latest) return;

        let lastSeen = "";
        try {
          lastSeen = window.localStorage.getItem(SEEN_STORAGE_KEY) ?? "";
        } catch {
          // stockage indisponible : on affiche quand même, tant pis pour la mémorisation
        }

        if (latest.id !== lastSeen) {
          setUpdate(latest);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  function handleClose() {
    setVisible(false);
    if (update) {
      try {
        window.localStorage.setItem(SEEN_STORAGE_KEY, update.id);
      } catch {
        // tant pis, le pop-up pourra réapparaître
      }
    }
  }

  if (!visible || !update) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
    >
      <div
        className="animate-greeting-pop relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="relative mx-auto mb-4 mt-2 h-20 w-20">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy text-4xl shadow-lg">
            {update.icon}
          </span>
          <span className="absolute -right-2 -top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow">
            Nouveau
          </span>
        </div>

        <h2 className="text-xl font-extrabold uppercase text-navy">{update.title}</h2>
        <p className="mt-2 text-gray-600">{update.description}</p>

        {update.link_href ? (
          <a
            href={update.link_href}
            onClick={handleClose}
            className="btn-accent mt-5 block w-full text-center text-base font-extrabold uppercase tracking-wide"
          >
            {update.link_label || "Découvrir"}
          </a>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="btn-accent mt-5 w-full text-base font-extrabold uppercase tracking-wide"
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
