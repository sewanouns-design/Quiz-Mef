"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const GAMES = [{ href: "/trouve-le-verset", icon: "📖", label: "Trouve le verset" }];

/**
 * Menu hamburger compact, en haut à gauche de chaque page (hors quiz en
 * cours, pour les mêmes raisons anti-triche que SiteHeader) : Accueil, Jeux
 * (sous-menu — un seul jeu pour l'instant, mais pensé pour en accueillir
 * d'autres sans changer la structure), À propos, Contact. Remplace les liens
 * épars qui encombraient la page d'accueil.
 */
export default function SiteMenu({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function close() {
    setOpen(false);
    setGamesOpen(false);
  }

  const buttonClass =
    variant === "dark"
      ? "flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
      : "flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-navy shadow-sm transition-colors hover:bg-gray-50";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className={buttonClass}
      >
        <span className="text-lg leading-none">☰</span>
      </button>

      {open && (
        <div className="animate-menu-pop absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
          >
            🏠 Accueil
          </Link>

          <button
            type="button"
            onClick={() => setGamesOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
          >
            <span className="flex items-center gap-2.5">🎮 Jeux</span>
            <span
              className={`text-xs text-gray-400 transition-transform duration-150 ${
                gamesOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>
          {gamesOpen && (
            <div className="ml-3 space-y-0.5 border-l-2 border-gray-100 py-1 pl-2">
              {GAMES.map((game) => (
                <Link
                  key={game.href}
                  href={game.href}
                  onClick={close}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-navy/5 hover:text-navy"
                >
                  {game.icon} {game.label}
                </Link>
              ))}
            </div>
          )}

          <div className="my-1.5 border-t border-gray-100" />

          <Link
            href="/a-propos"
            onClick={close}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
          >
            ℹ️ À propos
          </Link>
          <Link
            href="/contact"
            onClick={close}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
          >
            ✉️ Contact
          </Link>
        </div>
      )}
    </div>
  );
}
