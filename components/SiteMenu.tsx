"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface MenuLink {
  href: string;
  icon: string;
  label: string;
}

// Chaque groupe est visuellement séparé (léger fond + bordure) pour bien
// distinguer "où aller sur le site" de "vers quoi mène ce lien" — plus
// besoin de sous-menu dépliable : "Jeux" mène directement à la liste des
// jeux disponibles (/jeux), qui pourra en accueillir d'autres plus tard.
const MENU_GROUPS: MenuLink[][] = [
  [{ href: "/", icon: "🏠", label: "Accueil" }],
  [
    { href: "/jeux", icon: "🎮", label: "Jeux" },
    { href: "/a-propos", icon: "ℹ️", label: "À propos" },
    { href: "/contact", icon: "✉️", label: "Contact" },
  ],
];

/**
 * Menu hamburger compact, en haut à gauche de chaque page (hors quiz en
 * cours, pour les mêmes raisons anti-triche que SiteHeader).
 */
export default function SiteMenu({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
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
        <div className="animate-menu-pop absolute left-0 top-full z-40 mt-2 w-64 space-y-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl">
          {MENU_GROUPS.map((group, i) => (
            <div key={i} className="rounded-xl bg-gray-50/80 p-1">
              {group.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-white hover:shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-base shadow-sm transition-transform duration-150 group-hover:scale-110">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
