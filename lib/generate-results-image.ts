export type ResultsShareTemplate = "classic" | "celebration" | "custom";

export interface ResultsImageParams {
  participantName: string;
  score: number;
  maxScore: number;
  quizTitle: string;
  attemptNumber?: number;
  visual?: {
    template?: ResultsShareTemplate;
    customBackground?: string | null;
    customTextColor?: string;
    customTitleY?: number;
    customNameY?: number;
    customScoreY?: number;
  };
}

const NAVY = "#14213d";
const NAVY_DARK = "#0a1428";
const ACCENT = "#b91c1c";
const ACCENT_LIGHT = "#dc2626";
const WIDTH = 1080;
const HEIGHT = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger le modèle visuel importé."));
    image.src = source;
  });
}

function drawClassic(ctx: CanvasRenderingContext2D, params: ResultsImageParams) {
  const { participantName, score, maxScore, quizTitle, attemptNumber } = params;
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, NAVY);
  bg.addColorStop(1, NAVY_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const dotColors = [ACCENT, ACCENT_LIGHT, "#ffffff"];
  for (let i = 0; i < 55; i++) {
    const radius = Math.random() * 7 + 3;
    ctx.beginPath();
    ctx.fillStyle = dotColors[Math.floor(Math.random() * dotColors.length)];
    ctx.globalAlpha = Math.random() * 0.3 + 0.1;
    ctx.arc(Math.random() * WIDTH, Math.random() * (HEIGHT * 0.85), radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "800 30px sans-serif";
  ctx.fillText("⁉️ QUIZ BIBLIQUE", 64, 90);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 24px sans-serif";
  ctx.fillText("quiz.mefzogbadje.org", WIDTH - 64, 88);
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(WIDTH / 2, 330);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = "900 128px sans-serif";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.strokeText("FÉLICITATIONS", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 84px sans-serif";
  ctx.fillText("FÉLICITATIONS !", WIDTH / 2, 400);

  let cursorY = 400;
  if (attemptNumber && attemptNumber > 1) {
    const label = `🔁 ${attemptNumber}ᵉ TENTATIVE`;
    ctx.font = "700 24px sans-serif";
    const labelWidth = ctx.measureText(label).width + 48;
    const pillY = cursorY + 40;
    roundRect(ctx, WIDTH / 2 - labelWidth / 2, pillY, labelWidth, 56, 28);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, WIDTH / 2, pillY + 37);
    cursorY = pillY + 56;
  }

  const medalCenterY = cursorY + 155;
  const medalGradient = ctx.createRadialGradient(WIDTH / 2, medalCenterY, 10, WIDTH / 2, medalCenterY, 100);
  medalGradient.addColorStop(0, ACCENT_LIGHT);
  medalGradient.addColorStop(1, ACCENT);
  ctx.save();
  ctx.shadowColor = "rgba(185,28,28,0.55)";
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, medalCenterY, 100, 0, Math.PI * 2);
  ctx.fillStyle = medalGradient;
  ctx.fill();
  ctx.restore();
  ctx.font = "116px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("🎉", WIDTH / 2, medalCenterY + 6);
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 44px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const afterName = wrapText(ctx, participantName, WIDTH / 2, medalCenterY + 150, WIDTH - 220, 52);
  const badgeY = afterName + 55;
  roundRect(ctx, WIDTH / 2 - 210, badgeY, 420, 130, 28);
  ctx.fillStyle = "rgba(185,28,28,0.18)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ACCENT_LIGHT;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 22px sans-serif";
  ctx.fillText("SCORE OBTENU", WIDTH / 2, badgeY + 38);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px sans-serif";
  ctx.fillText(`${score} / ${maxScore}`, WIDTH / 2, badgeY + 96);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "500 26px sans-serif";
  wrapText(ctx, quizTitle, WIDTH / 2, badgeY + 195, WIDTH - 220, 34);
}

function drawCelebration(ctx: CanvasRenderingContext2D, params: ResultsImageParams) {
  const { participantName, score, maxScore, quizTitle } = params;
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#142f63");
  bg.addColorStop(0.55, "#132a59");
  bg.addColorStop(1, "#49213f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.82, HEIGHT * 0.1, 20, WIDTH * 0.82, HEIGHT * 0.1, 500);
  glow.addColorStop(0, "rgba(255,0,40,0.22)");
  glow.addColorStop(1, "rgba(255,0,40,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, 220, 118, 0, Math.PI * 2);
  ctx.fillStyle = "#f00818";
  ctx.shadowColor = "rgba(255,0,20,0.45)";
  ctx.shadowBlur = 32;
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "124px sans-serif";
  ctx.fillText("🎉", WIDTH / 2, 262);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 32px sans-serif";
  wrapText(ctx, quizTitle.toUpperCase(), WIDTH / 2, 405, WIDTH - 180, 40);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 66px sans-serif";
  wrapText(ctx, `Félicitations, ${participantName} !`, WIDTH / 2, 560, WIDTH - 150, 78);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 32px sans-serif";
  ctx.fillText("Tu as réussi le quiz avec brio.", WIDTH / 2, 760);

  roundRect(ctx, WIDTH / 2 - 275, 830, 550, 235, 34);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "700 28px sans-serif";
  ctx.fillText("SCORE TOTAL", WIDTH / 2, 910);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 88px sans-serif";
  ctx.fillText(`${score} / ${maxScore}`, WIDTH / 2, 1005);
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = "500 24px sans-serif";
  ctx.fillText("Quiz Biblique MEF", WIDTH / 2, 1210);
}

async function drawCustom(ctx: CanvasRenderingContext2D, params: ResultsImageParams) {
  const { participantName, score, maxScore, quizTitle } = params;
  const visual = params.visual ?? {};
  if (!visual.customBackground) {
    drawCelebration(ctx, params);
    return;
  }
  const image = await loadImage(visual.customBackground);
  drawCover(ctx, image);
  const color = visual.customTextColor || "#ffffff";
  const titleY = Math.min(90, Math.max(8, visual.customTitleY ?? 30)) / 100 * HEIGHT;
  const nameY = Math.min(90, Math.max(8, visual.customNameY ?? 48)) / 100 * HEIGHT;
  const scoreY = Math.min(92, Math.max(8, visual.customScoreY ?? 69)) / 100 * HEIGHT;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.font = "700 34px sans-serif";
  wrapText(ctx, quizTitle.toUpperCase(), WIDTH / 2, titleY, WIDTH - 180, 42);
  ctx.font = "900 66px sans-serif";
  wrapText(ctx, `Félicitations, ${participantName} !`, WIDTH / 2, nameY, WIDTH - 130, 78);
  ctx.font = "500 30px sans-serif";
  ctx.fillText("Tu as réussi le quiz avec brio.", WIDTH / 2, nameY + 120);
  roundRect(ctx, WIDTH / 2 - 270, scoreY, 540, 220, 32);
  ctx.fillStyle = "rgba(20,33,61,0.35)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 28px sans-serif";
  ctx.fillText("SCORE TOTAL", WIDTH / 2, scoreY + 78);
  ctx.font = "900 84px sans-serif";
  ctx.fillText(`${score} / ${maxScore}`, WIDTH / 2, scoreY + 170);
  ctx.shadowBlur = 0;
}

export async function generateResultsImage(params: ResultsImageParams): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le rendu canvas n'est pas supporté sur cet appareil.");

  const template = params.visual?.template ?? "celebration";
  if (template === "classic") drawClassic(ctx, params);
  else if (template === "custom") await drawCustom(ctx, params);
  else drawCelebration(ctx, params);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de générer l'image."));
    }, "image/png");
  });
}
