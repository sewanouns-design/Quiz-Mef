"use client";

import { useEffect, useState } from "react";

// Événement non standardisé (Chrome/Edge/Android uniquement) : pas de type
// officiel dans lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari iOS n'expose display-mode standalone que partiellement.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Bannière discrète invitant à installer le site en PWA ("Ajouter à l'écran
 * d'accueil") : transforme un lien qu'on oublie en icône sur l'écran
 * d'accueil, consultée comme une vraie appli.
 *
 * Volontairement AUCUNE mémorisation de fermeture : fermer avec ✕ ou refuser
 * l'invite native ne cache la bannière que pour la visite en cours — elle
 * réapparaît à chaque nouvelle connexion tant que le site n'est pas
 * réellement installé (seul isStandalone() l'arrête, pour de bon). C'est
 * un choix produit explicite : on insiste jusqu'à l'installation plutôt que
 * de se laisser définitivement écarter par une fermeture.
 *
 * Deux chemins :
 * - Android/Chrome/Edge : l'événement natif beforeinstallprompt est capturé,
 *   le clic déclenche directement l'invite native du navigateur.
 * - iOS Safari : cet événement n'existe pas, on affiche des instructions
 *   manuelles (Safari ne permet pas de déclencher l'installation par code).
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Réservé au site public : pas de bruit pour l'équipe dans l'admin.
    if (window.location.pathname.startsWith("/admin")) return;
    if (isStandalone()) return;

    if (isIos()) {
      setShowIosInstructions(true);
      setVisible(true);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    // Pas de mémorisation : simple fermeture pour cette visite, elle
    // reviendra à la prochaine connexion (voir commentaire du composant).
    setVisible(false);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    // Si accepté : isStandalone() empêchera la bannière de revenir. Si
    // refusé : rien à mémoriser, elle reviendra à la prochaine connexion.
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-2xl">
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-navy">Installe le Quiz Biblique</p>
          <p className="truncate text-xs text-gray-500">
            {showIosInstructions
              ? "Appuie sur Partager, puis « Sur l'écran d'accueil »."
              : "Ajoute-le à ton écran d'accueil pour y accéder en un geste."}
          </p>
        </div>
        {!showIosInstructions && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="shrink-0 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-light"
          >
            Installer
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
