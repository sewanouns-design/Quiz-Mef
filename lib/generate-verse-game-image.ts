// Image partageable générée à la fin d'un niveau de "Trouve le verset",
// sur le même principe visuel que lib/generate-results-image.ts (quiz du
// jour), pour inciter les gens qui la voient à venir jouer eux aussi.
export interface VerseGameImageParams {
  participantName: string;
  level: number;
  leveledUp: boolean;
  totalPoints: number;
  rank: number | null;
}

const NAVY = "#14213d";
const NAVY_DARK = "#0a1428";
const ACCENT = "#b91c1c";
const ACCENT_LIGHT = "#dc2626";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
  return curY;
}

export async function generateVerseGameImage(params: VerseGameImageParams): Promise<Blob> {
  const { participantName, level, leveledUp, totalPoints, rank } = params;
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le rendu canvas n'est pas supporté sur cet appareil.");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, NAVY);
  bg.addColorStop(1, NAVY_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const dotColors = [ACCENT, ACCENT_LIGHT, "#ffffff"];
  for (let i = 0; i < 55; i++) {
    const r = Math.random() * 7 + 3;
    ctx.beginPath();
    ctx.fillStyle = dotColors[Math.floor(Math.random() * dotColors.length)];
    ctx.globalAlpha = Math.random() * 0.3 + 0.1;
    ctx.arc(Math.random() * width, Math.random() * (height * 0.85), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "800 30px sans-serif";
  ctx.fillText("📖 TROUVE LE VERSET", 64, 90);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 24px sans-serif";
  ctx.fillText("quiz.mefzogbadje.org", width - 64, 88);

  ctx.textAlign = "center";

  ctx.save();
  ctx.translate(width / 2, 330);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = "900 110px sans-serif";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.strokeText("NIVEAU " + level, 0, 0);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px sans-serif";
  ctx.fillText(leveledUp ? "NIVEAU DÉBLOQUÉ !" : "NIVEAU TERMINÉ !", width / 2, 400);

  const cursorY = 400;

  const medalCenterY = cursorY + 155;
  const medalRadius = 100;
  const medalGradient = ctx.createRadialGradient(
    width / 2,
    medalCenterY,
    10,
    width / 2,
    medalCenterY,
    medalRadius
  );
  medalGradient.addColorStop(0, ACCENT_LIGHT);
  medalGradient.addColorStop(1, ACCENT);
  ctx.save();
  ctx.shadowColor = "rgba(185,28,28,0.55)";
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(width / 2, medalCenterY, medalRadius, 0, Math.PI * 2);
  ctx.fillStyle = medalGradient;
  ctx.fill();
  ctx.restore();

  ctx.font = "116px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("📖", width / 2, medalCenterY + 6);
  ctx.textBaseline = "alphabetic";

  ctx.font = "600 44px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const afterName = wrapText(ctx, participantName, width / 2, medalCenterY + 150, width - 220, 52);

  const badgeY = afterName + 55;
  const badgeH = 130;
  const badgeW = 460;
  const badgeX = width / 2 - badgeW / 2;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 28);
  ctx.fillStyle = "rgba(185,28,28,0.18)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ACCENT_LIGHT;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 22px sans-serif";
  ctx.fillText("NIVEAU ATTEINT", width / 2, badgeY + 38);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px sans-serif";
  ctx.fillText(`${level} / 100`, width / 2, badgeY + 96);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "500 26px sans-serif";
  const pointsLine = rank
    ? `🏅 ${totalPoints} points · #${rank} au classement`
    : `🏅 ${totalPoints} points cumulés`;
  wrapText(ctx, pointsLine, width / 2, badgeY + badgeH + 65, width - 220, 34);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de générer l'image."));
    }, "image/png");
  });
}
