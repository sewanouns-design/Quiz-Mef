"use client";

import { useEffect, useState } from "react";
import type { SiteUpdate } from "@/lib/types";

const SEEN_STORAGE_KEY = "mef_last_seen_update";

/**
 * Pop-up fermable listant brièvement les nouveautés du site pas encore vues
 * sur cet appareil (comparé à l'id de la plus récente déjà vue, en
 * localStorage). Contrairement au pop-up du quiz hebdo, fermer celui-ci le
 * fait disparaître DÉFINITIVEMENT pour ces nouveautés précises — il ne
 * revient qu'au moment où l'admin en publie de nouvelles.
 */
export default function NewsPopup() {
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch("/api/site-updates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const all: SiteUpdate[] = data.updates ?? [];
        if (all.length === 0) return;

        let lastSeen = "";
        try {
          lastSeen = window.localStorage.getItem(SEEN_STORAGE_KEY) ?? "";
        } catch {
          // stockage indisponible : on affiche quand même, tant pis pour la mémorisation
        }

        const lastSeenIndex = all.findIndex((u) => u.id === lastSeen);
        const unseen = lastSeenIndex === -1 ? all : all.slice(0, lastSeenIndex);

        if (unseen.length > 0) {
          setUpdates(unseen);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  function handleClose() {
    setVisible(false);
    if (updates.length > 0) {
      try {
        window.localStorage.setItem(SEEN_STORAGE_KEY, updates[0].id);
      } catch {
        // tant pis, le pop-up pourra réapparaître
      }
    }
  }

  if (!visible || updates.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleClose}
    >
      <div
        className="animate-greeting-pop relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
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
        <div className="mb-3 text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-2xl">
            🆕
          </span>
          <p className="text-xs font-bold uppercase tracking-wide text-navy/60">Quoi de neuf</p>
        </div>
        <ul className="space-y-3">
          {updates.map((u) => (
            <li key={u.id} className="rounded-xl bg-navy/5 p-3">
              <p className="font-semibold text-navy">{u.title}</p>
              <p className="mt-0.5 text-sm text-gray-600">{u.description}</p>
              {u.link_href && (
                <a
                  href={u.link_href}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent-dark hover:underline"
                >
                  {u.link_label || "Découvrir"} →
                </a>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={handleClose} className="btn-accent mt-4 w-full">
          Fermer
        </button>
      </div>
    </div>
  );
}
