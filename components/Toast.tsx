"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISPLAY_MS = 6000;
// Durée du fondu de sortie — doit correspondre à la transition CSS
// (`transition-opacity duration-300`) pour ne pas retirer l'élément du DOM
// avant la fin de l'animation.
const FADE_MS = 300;

/**
 * Notifications flottantes site-wide (succès/échec d'une action), pensées
 * en premier lieu pour les écrans admin : remplace les messages inline
 * "Enregistré." / "Erreur : ..." qu'il fallait défiler pour voir, par un
 * pop-up qui apparaît directement à l'écran, reste quelques secondes puis
 * disparaît en fondu — sans jamais bloquer la suite de l'action.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message, leaving: false }]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, FADE_MS);
    }, DISPLAY_MS);
  }, []);

  const value: ToastContextValue = {
    success: useCallback((message: string) => push("success", message), [push]),
    error: useCallback((message: string) => push("error", message), [push]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-5"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-opacity duration-300 ${
              t.leaving ? "opacity-0" : "opacity-100"
            } ${
              t.type === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                : "border-red-200 bg-red-50/95 text-red-700"
            }`}
          >
            <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">
              {t.type === "success" ? "✅" : "⚠️"}
            </span>
            <p className="text-sm font-medium leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de <ToastProvider>.");
  return ctx;
}
