"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function getOrCreateStorageId(storage: Storage, key: string): string {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    storage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function sendEvent(event: Record<string, unknown>) {
  const payload = JSON.stringify({ events: [event] });
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

function currentLabel(element: HTMLElement): string | undefined {
  const explicit = element.dataset.analyticsLabel || element.getAttribute("aria-label");
  if (explicit) return explicit.slice(0, 120);
  if (element instanceof HTMLAnchorElement) return element.getAttribute("href")?.slice(0, 120);
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 120) : undefined;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const sessionStarted = useRef(false);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const visitorId = getOrCreateStorageId(window.localStorage, "quiz-mef-analytics-visitor");
    const sessionId = getOrCreateStorageId(window.sessionStorage, "quiz-mef-analytics-session");
    const base = {
      visitorId,
      sessionId,
      path: pathname,
      pageTitle: document.title,
      referrer: document.referrer || undefined,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    };

    if (!sessionStarted.current) {
      sessionStarted.current = true;
      sendEvent({ ...base, eventType: "session_start", eventName: "session_start" });
    }
    sendEvent({ ...base, eventType: "page_view", eventName: "page_view" });

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest("a,button,[data-analytics]");
      if (!(element instanceof HTMLElement)) return;
      if (element.closest("[data-analytics-ignore]")) return;

      const href = element instanceof HTMLAnchorElement ? element.href : undefined;
      let targetPath: string | undefined;
      if (href) {
        try {
          const url = new URL(href, window.location.origin);
          if (url.origin === window.location.origin) targetPath = url.pathname;
        } catch {
          targetPath = undefined;
        }
      }

      sendEvent({
        ...base,
        eventType: "click",
        eventName: element.dataset.analytics || element.tagName.toLowerCase(),
        label: currentLabel(element),
        targetPath,
      });
    }

    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
