export type ShareVisualMode = "daily" | "quarterly";
export type ShareBackgroundStyle = "celebration" | "classic" | "plain";
export type ShareTextAlign = "left" | "center" | "right";

export interface ShareTextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
  color: string;
  fontWeight: number;
  align: ShareTextAlign;
  visible: boolean;
}

export interface ShareVisualConfig {
  backgroundStyle: ShareBackgroundStyle;
  background: string | null;
  layers: ShareTextLayer[];
}

const DAILY_LAYERS: ShareTextLayer[] = [
  { id: "eyebrow", text: "QUIZ DU JOUR", x: 50, y: 13, maxWidth: 88, fontSize: 26, color: "#ffffff", fontWeight: 700, align: "center", visible: true },
  { id: "title", text: "{{quizTitle}}", x: 50, y: 25, maxWidth: 82, fontSize: 30, color: "#ffffff", fontWeight: 700, align: "center", visible: true },
  { id: "name", text: "Félicitations, {{participantName}} !", x: 50, y: 40, maxWidth: 88, fontSize: 58, color: "#ffffff", fontWeight: 900, align: "center", visible: true },
  { id: "message", text: "Tu as réussi le quiz avec brio.", x: 50, y: 57, maxWidth: 88, fontSize: 30, color: "#ffffff", fontWeight: 500, align: "center", visible: true },
  { id: "score-label", text: "SCORE TOTAL", x: 50, y: 66, maxWidth: 70, fontSize: 24, color: "#ffffff", fontWeight: 700, align: "center", visible: true },
  { id: "score", text: "{{score}} / {{maxScore}}", x: 50, y: 73, maxWidth: 75, fontSize: 82, color: "#ffffff", fontWeight: 900, align: "center", visible: true },
  { id: "footer", text: "{{siteName}}", x: 50, y: 91, maxWidth: 84, fontSize: 22, color: "#ffffff", fontWeight: 500, align: "center", visible: true },
];

const QUARTERLY_LAYERS: ShareTextLayer[] = [
  { id: "eyebrow", text: "CONCOURS TRIMESTRIEL", x: 50, y: 12, maxWidth: 90, fontSize: 28, color: "#ffffff", fontWeight: 800, align: "center", visible: true },
  { id: "quarter", text: "{{quarterLabel}}", x: 50, y: 21, maxWidth: 88, fontSize: 27, color: "#ffffff", fontWeight: 500, align: "center", visible: true },
  { id: "rank", text: "{{rankLabel}}", x: 50, y: 32, maxWidth: 88, fontSize: 48, color: "#ffffff", fontWeight: 900, align: "center", visible: true },
  { id: "name", text: "{{participantName}}", x: 50, y: 45, maxWidth: 88, fontSize: 62, color: "#ffffff", fontWeight: 900, align: "center", visible: true },
  { id: "exam", text: "Examen final : {{examScore}} / 20", x: 50, y: 59, maxWidth: 85, fontSize: 25, color: "#ffffff", fontWeight: 600, align: "center", visible: true },
  { id: "average", text: "Moyenne pédagogique : {{pedagogicalAverage}} / 20", x: 50, y: 65, maxWidth: 88, fontSize: 25, color: "#ffffff", fontWeight: 600, align: "center", visible: true },
  { id: "final", text: "Score global : {{finalScore}}", x: 50, y: 72, maxWidth: 82, fontSize: 31, color: "#ffffff", fontWeight: 800, align: "center", visible: true },
  { id: "prize", text: "{{prize}}", x: 50, y: 81, maxWidth: 82, fontSize: 28, color: "#ffffff", fontWeight: 700, align: "center", visible: true },
  { id: "footer", text: "{{siteName}}", x: 50, y: 93, maxWidth: 84, fontSize: 22, color: "#ffffff", fontWeight: 500, align: "center", visible: true },
];

export const DEFAULT_DAILY_SHARE_CONFIG: ShareVisualConfig = {
  backgroundStyle: "celebration",
  background: null,
  layers: DAILY_LAYERS,
};

export const DEFAULT_QUARTERLY_SHARE_CONFIG: ShareVisualConfig = {
  backgroundStyle: "celebration",
  background: null,
  layers: QUARTERLY_LAYERS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLayer(value: unknown, fallback: ShareTextLayer): ShareTextLayer {
  if (!isRecord(value)) return { ...fallback };
  const align = value.align === "left" || value.align === "right" ? value.align : "center";
  const number = (candidate: unknown, defaultValue: number, min: number, max: number) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : defaultValue;
  };
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id.slice(0, 80) : fallback.id,
    text: typeof value.text === "string" ? value.text.slice(0, 300) : fallback.text,
    x: number(value.x, fallback.x, 0, 100),
    y: number(value.y, fallback.y, 0, 100),
    maxWidth: number(value.maxWidth, fallback.maxWidth, 10, 100),
    fontSize: number(value.fontSize, fallback.fontSize, 10, 160),
    color: typeof value.color === "string" && /^#[0-9a-fA-F]{6}$/.test(value.color) ? value.color : fallback.color,
    fontWeight: number(value.fontWeight, fallback.fontWeight, 300, 900),
    align,
    visible: value.visible !== false,
  };
}

export function defaultShareVisualConfig(mode: ShareVisualMode): ShareVisualConfig {
  return mode === "quarterly"
    ? { ...DEFAULT_QUARTERLY_SHARE_CONFIG, layers: DEFAULT_QUARTERLY_SHARE_CONFIG.layers.map((layer) => ({ ...layer })) }
    : { ...DEFAULT_DAILY_SHARE_CONFIG, layers: DEFAULT_DAILY_SHARE_CONFIG.layers.map((layer) => ({ ...layer })) };
}

export function normalizeShareVisualConfig(value: unknown, mode: ShareVisualMode): ShareVisualConfig {
  const fallback = defaultShareVisualConfig(mode);
  if (!isRecord(value)) return fallback;
  const backgroundStyle = value.backgroundStyle === "classic" || value.backgroundStyle === "plain" ? value.backgroundStyle : "celebration";
  const layersValue = Array.isArray(value.layers) ? value.layers.slice(0, 20) : [];
  const layers = layersValue.length
    ? layersValue.map((layer, index) => normalizeLayer(layer, fallback.layers[index] ?? fallback.layers[fallback.layers.length - 1]))
    : fallback.layers;
  return {
    backgroundStyle,
    background: typeof value.background === "string" && value.background.length <= 2_200_000 ? value.background : null,
    layers,
  };
}

export function shareConfigIsValid(value: unknown): value is ShareVisualConfig {
  if (!isRecord(value)) return false;
  if (!["celebration", "classic", "plain"].includes(String(value.backgroundStyle))) return false;
  if (value.background !== null && value.background !== undefined && (typeof value.background !== "string" || value.background.length > 2_200_000)) return false;
  if (!Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > 20) return false;
  return value.layers.every((layer) => {
    if (!isRecord(layer)) return false;
    return typeof layer.id === "string" && typeof layer.text === "string" && layer.text.length <= 300 &&
      Number.isFinite(Number(layer.x)) && Number(layer.x) >= 0 && Number(layer.x) <= 100 &&
      Number.isFinite(Number(layer.y)) && Number(layer.y) >= 0 && Number(layer.y) <= 100 &&
      Number.isFinite(Number(layer.maxWidth)) && Number(layer.maxWidth) >= 10 && Number(layer.maxWidth) <= 100 &&
      Number.isFinite(Number(layer.fontSize)) && Number(layer.fontSize) >= 10 && Number(layer.fontSize) <= 160 &&
      typeof layer.color === "string" && /^#[0-9a-fA-F]{6}$/.test(layer.color) &&
      Number.isFinite(Number(layer.fontWeight)) && Number(layer.fontWeight) >= 300 && Number(layer.fontWeight) <= 900 &&
      ["left", "center", "right"].includes(String(layer.align)) && typeof layer.visible === "boolean";
  });
}

export function interpolateShareText(text: string, values: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? "" : String(value);
  }).replace(/\s{2,}/g, " ").trim();
}
