"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation impossible (navigateur non supporté, etc.) : le site
        // reste utilisable normalement sans mode PWA.
      });
    }
  }, []);

  return null;
}
