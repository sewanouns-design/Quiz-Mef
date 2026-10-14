export type AnalyticsEventType = "page_view" | "click" | "page_exit" | "session_start";

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  visitorId: string;
  sessionId: string;
  path: string;
  pageTitle?: string;
  referrer?: string;
  targetPath?: string;
  eventName?: string;
  label?: string;
  screenWidth?: number;
  screenHeight?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedAnalyticsEvent extends AnalyticsEventInput {
  deviceType: string;
  browser: string;
  operatingSystem: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  isBot: boolean;
}

export const ANALYTICS_EVENT_TYPES: AnalyticsEventType[] = [
  "page_view",
  "click",
  "page_exit",
  "session_start",
];

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return cleaned || null;
}

function cleanPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const path = value.split(/[?#]/, 1)[0].slice(0, 256);
  return path || "/";
}

function cleanId(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const id = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return id || "unknown";
}

function cleanPositiveInteger(value: unknown, max: number): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) return null;
  return number;
}

function sanitizeReferrer(value: unknown): string | null {
  const raw = cleanText(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

export function parseUserAgent(userAgent: string | null): {
  deviceType: string;
  browser: string;
  operatingSystem: string;
  isBot: boolean;
} {
  const ua = userAgent ?? "";
  const lower = ua.toLowerCase();
  const isBot = /bot|crawler|spider|slurp|headless|preview|facebookexternalhit|bingpreview/.test(lower);

  const deviceType = /ipad|tablet|playbook|silk/.test(lower)
    ? "tablette"
    : /mobi|iphone|ipod|android/.test(lower)
      ? "mobile"
      : /windows|macintosh|linux|cros/.test(lower)
        ? "ordinateur"
        : "inconnu";

  const browser = /edg\//.test(lower)
    ? "Edge"
    : /opr\//.test(lower) || /opera/.test(lower)
      ? "Opera"
      : /chrome\//.test(lower) && !/chromium/.test(lower)
        ? "Chrome"
        : /firefox\//.test(lower)
          ? "Firefox"
          : /safari\//.test(lower) && !/chrome\//.test(lower)
            ? "Safari"
            : /android/.test(lower)
              ? "Navigateur Android"
              : "Autre";

  const operatingSystem = /android/.test(lower)
    ? "Android"
    : /iphone|ipad|ipod/.test(lower)
      ? "iOS"
      : /windows/.test(lower)
        ? "Windows"
        : /mac os/.test(lower) || /macintosh/.test(lower)
          ? "macOS"
          : /cros/.test(lower)
            ? "ChromeOS"
            : /linux/.test(lower)
              ? "Linux"
              : "Autre";

  return { deviceType, browser, operatingSystem, isBot };
}

export function getAnalyticsGeo(headers: Headers): {
  countryCode: string | null;
  region: string | null;
  city: string | null;
} {
  const country = cleanText(
    headers.get("x-vercel-ip-country") ?? headers.get("x-country") ?? headers.get("cf-ipcountry"),
    8
  );
  return {
    countryCode: country ? country.toUpperCase() : null,
    region: cleanText(headers.get("x-vercel-ip-country-region") ?? headers.get("x-region"), 80),
    city: cleanText(headers.get("x-vercel-ip-city") ?? headers.get("x-city"), 100),
  };
}

export function normalizeAnalyticsEvent(
  input: unknown,
  headers: Headers
): NormalizedAnalyticsEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const eventType = ANALYTICS_EVENT_TYPES.includes(raw.eventType as AnalyticsEventType)
    ? (raw.eventType as AnalyticsEventType)
    : null;
  if (!eventType) return null;

  const parsedAgent = parseUserAgent(headers.get("user-agent"));
  const geo = getAnalyticsGeo(headers);
  return {
    eventType,
    visitorId: cleanId(raw.visitorId),
    sessionId: cleanId(raw.sessionId),
    path: cleanPath(raw.path),
    pageTitle: cleanText(raw.pageTitle, 160) ?? undefined,
    referrer: sanitizeReferrer(raw.referrer) ?? undefined,
    targetPath: cleanPath(raw.targetPath ?? raw.path),
    eventName: cleanText(raw.eventName, 80) ?? undefined,
    label: cleanText(raw.label, 120) ?? undefined,
    screenWidth: cleanPositiveInteger(raw.screenWidth, 10000) ?? undefined,
    screenHeight: cleanPositiveInteger(raw.screenHeight, 10000) ?? undefined,
    durationMs: cleanPositiveInteger(raw.durationMs, 86_400_000) ?? undefined,
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata as Record<string, unknown> : undefined,
    ...parsedAgent,
    ...geo,
  };
}
