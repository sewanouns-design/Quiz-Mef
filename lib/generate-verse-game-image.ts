// Image partageable générée à la fin d'un niveau de "Trouve le verset", pour
// inciter les gens qui la voient à venir jouer eux aussi. Même gabarit que
// lib/generate-results-image.ts (quiz du jour), mais habillage volontairement
// distinct — couleur d'accent sarcelle plutôt que rouge, médaillon carré
// façon page de livre plutôt que rond, confettis en petits rectangles façon
// pages plutôt qu'en points — pour qu'une image "jeu" ne se confonde jamais
// avec une image "quiz" au premier coup d'œil.
export interface VerseGameImageParams {
  participantName: string;
  level: number;
  leveledUp: boolean;
  totalPoints: number;
  rank: number | null;
}

const NAVY = "#14213d";
const NAVY_DARK = "#0a1428";
const ACCENT = "#0d9488";
const ACCENT_LIGHT = "#2dd4bf";

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

  // Petites "pages" rectangulaires flottantes plutôt que des confettis
  // circulaires — motif distinct du quiz pour qu'une image "jeu" se
  // reconnaisse au premier coup d'œil, même en miniature.
  const pageColors = [ACCENT, ACCENT_LIGHT, "#ffffff"];
  for (let i = 0; i < 40; i++) {
    const w = Math.random() * 16 + 10;
    const h = w * 1.3;
    ctx.save();
    ctx.translate(Math.random() * width, Math.random() * (height * 0.85));
    ctx.rotate(((Math.random() * 50 - 25) * Math.PI) / 180);
    ctx.globalAlpha = Math.random() * 0.25 + 0.08;
    ctx.fillStyle = pageColors[Math.floor(Math.random() * pageColors.length)];
    roundRect(ctx, -w / 2, -h / 2, w, h, 3);
    ctx.fill();
    ctx.restore();
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

  // Médaillon carré arrondi façon page de livre (coin pas plié, pour rester
  // simple au rendu) plutôt que le rond du quiz.
  const medalCenterY = cursorY + 155;
  const medalSize = 190;
  const medalX = width / 2 - medalSize / 2;
  const medalY = medalCenterY - medalSize / 2;
  const medalGradient = ctx.createLinearGradient(medalX, medalY, medalX, medalY + medalSize);
  medalGradient.addColorStop(0, ACCENT_LIGHT);
  medalGradient.addColorStop(1, ACCENT);
  ctx.save();
  ctx.shadowColor = "rgba(13,148,136,0.5)";
  ctx.shadowBlur = 40;
  roundRect(ctx, medalX, medalY, medalSize, medalSize, 36);
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
  ctx.fillStyle = "rgba(13,148,136,0.2)";
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
