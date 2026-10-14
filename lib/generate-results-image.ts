import {
  defaultShareVisualConfig,
  interpolateShareText,
  type ShareVisualConfig,
  type ShareVisualMode,
} from "@/lib/result-share";

export type ResultsShareTemplate = "classic" | "celebration" | "custom";

export interface ResultsImageParams {
  participantName: string;
  score: number;
  maxScore: number;
  quizTitle: string;
  attemptNumber?: number;
  siteName?: string;
  visual?: {
    template?: ResultsShareTemplate;
    customBackground?: string | null;
    customTextColor?: string;
    customTitleY?: number;
    customNameY?: number;
    customScoreY?: number;
    mode?: ShareVisualMode;
    config?: ShareVisualConfig;
    quarterLabel?: string;
    rank?: number | null;
    rankLabel?: string;
    examScore?: number | null;
    pedagogicalAverage?: number | null;
    finalScore?: number | null;
    prize?: string | null;
  };
}

const WIDTH = 1080;
const HEIGHT = 1350;
const NAVY = "#14213d";
const NAVY_DARK = "#0a1428";
const RED = "#f00818";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (WIDTH - imageWidth) / 2, (HEIGHT - imageHeight) / 2, imageWidth, imageHeight);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger le modèle visuel importé."));
    image.src = source;
  });
}

function drawFallbackBackground(ctx: CanvasRenderingContext2D, style: ShareVisualConfig["backgroundStyle"]) {
  if (style === "plain") {
    ctx.fillStyle = "#f7f6f2";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  if (style === "classic") {
    bg.addColorStop(0, NAVY);
    bg.addColorStop(1, NAVY_DARK);
  } else {
    bg.addColorStop(0, "#142f63");
    bg.addColorStop(0.55, "#132a59");
    bg.addColorStop(1, "#49213f");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (style === "celebration") {
    const glow = ctx.createRadialGradient(WIDTH * 0.82, HEIGHT * 0.1, 20, WIDTH * 0.82, HEIGHT * 0.1, 500);
    glow.addColorStop(0, "rgba(255,0,40,0.22)");
    glow.addColorStop(1, "rgba(255,0,40,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 220, 118, 0, Math.PI * 2);
    ctx.fillStyle = RED;
    ctx.shadowColor = "rgba(255,0,20,0.45)";
    ctx.shadowBlur = 32;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "124px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎉", WIDTH / 2, 230);
    ctx.textBaseline = "top";
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

function renderValues(params: ResultsImageParams) {
  const visual = params.visual ?? {};
  const rank = visual.rank ?? "";
  return {
    participantName: params.participantName || "Participant",
    quizTitle: params.quizTitle,
    score: params.score,
    maxScore: params.maxScore,
    siteName: params.siteName || "Quiz Biblique MEF",
    attemptNumber: params.attemptNumber ?? "",
    quarterLabel: visual.quarterLabel || "",
    rank,
    rankLabel: visual.rankLabel || (rank ? `${rank}${rank === 1 ? "er" : "e"} prix` : ""),
    examScore: visual.examScore ?? "",
    pedagogicalAverage: visual.pedagogicalAverage ?? "",
    finalScore: visual.finalScore ?? visual.examScore ?? "",
    prize: visual.prize || "",
  };
}

async function drawConfiguredVisual(ctx: CanvasRenderingContext2D, params: ResultsImageParams, config: ShareVisualConfig) {
  if (config.background) {
    try {
      const image = await loadImage(config.background);
      drawCover(ctx, image);
    } catch {
      drawFallbackBackground(ctx, config.backgroundStyle);
    }
  } else {
    drawFallbackBackground(ctx, config.backgroundStyle);
  }

  const values = renderValues(params);
  const visibleScore = config.layers.find((layer) => layer.visible && (layer.id === "score" || layer.id === "final"));
  if (visibleScore && !config.background && config.backgroundStyle === "celebration") {
    const y = (visibleScore.y / 100) * HEIGHT - 55;
    roundRect(ctx, WIDTH * 0.245, y, WIDTH * 0.51, HEIGHT * 0.17, 32);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.textBaseline = "top";
  ctx.shadowColor = config.backgroundStyle === "plain" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  for (const layer of config.layers) {
    if (!layer.visible) continue;
    const text = interpolateShareText(layer.text, values);
    if (!text) continue;
    const x = (layer.x / 100) * WIDTH;
    const y = (layer.y / 100) * HEIGHT;
    const maxWidth = (layer.maxWidth / 100) * WIDTH;
    ctx.textAlign = layer.align;
    ctx.fillStyle = layer.color;
    ctx.font = `${layer.fontWeight} ${layer.fontSize}px sans-serif`;
    wrapText(ctx, text, x, y, maxWidth, layer.fontSize * 1.18);
  }
  ctx.shadowBlur = 0;
}

export async function generateResultsImage(params: ResultsImageParams): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le rendu canvas n'est pas supporté sur cet appareil.");

  const mode = params.visual?.mode ?? "daily";
  let config = params.visual?.config;
  if (!config) {
    config = defaultShareVisualConfig(mode);
    if (params.visual?.template === "classic") config.backgroundStyle = "classic";
    if (params.visual?.template === "custom") {
      config.background = params.visual.customBackground ?? null;
      config.backgroundStyle = "celebration";
      if (params.visual.customTextColor) {
        config.layers = config.layers.map((layer) => ({ ...layer, color: params.visual?.customTextColor || layer.color }));
      }
    }
  }
  await drawConfiguredVisual(ctx, params, config);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de générer l'image."));
    }, "image/png");
  });
}
