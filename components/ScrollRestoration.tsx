"use client";

import { useEffect } from "react";

const PREFIX = "quiz-mef-scroll:";

/**
 * Conserve la position de défilement par URL pendant une actualisation.
 * La mémoire reste dans sessionStorage : elle est propre à l’onglet du
 * navigateur et ne partage aucune donnée de navigation avec le serveur.
 */
export default function ScrollRestoration() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const adminKey = url.pathname.startsWith("/admin/dashboard")
      ? `${url.pathname}?tab=${url.searchParams.get("tab") || ""}&subtab=${url.searchParams.get("subtab") || ""}`
      : url.pathname;
    const key = `${PREFIX}${adminKey}`;
    const restore = () => {
      const saved = Number(window.sessionStorage.getItem(key));
      if (Number.isFinite(saved) && saved > 0) {
        window.scrollTo({ top: saved, behavior: "auto" });
      }
    };
    const save = () => {
      window.sessionStorage.setItem(key, String(Math.round(window.scrollY)));
    };

    const frame = window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("beforeunload", save);
    window.addEventListener("pagehide", save);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  return null;
}
