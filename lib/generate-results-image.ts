export interface ResultsImageParams {
  participantName: string;
  score: number;
  maxScore: number;
  quizTitle: string;
  lessonDate: string;
  passed: boolean;
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

export async function generateResultsImage(params: ResultsImageParams): Promise<Blob> {
  const { participantName, score, maxScore, quizTitle, lessonDate, passed } = params;
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le rendu canvas n'est pas supporté sur cet appareil.");

  // Fond dégradé
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, NAVY);
  bg.addColorStop(1, NAVY_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Confettis discrets
  const dotColors = passed
    ? [ACCENT, ACCENT_LIGHT, "#ffffff"]
    : ["#ffffff", "#94a3b8"];
  const dotCount = passed ? 60 : 24;
  for (let i = 0; i < dotCount; i++) {
    const r = Math.random() * 7 + 3;
    ctx.beginPath();
    ctx.fillStyle = dotColors[Math.floor(Math.random() * dotColors.length)];
    ctx.globalAlpha = Math.random() * 0.35 + 0.12;
    ctx.arc(Math.random() * width, Math.random() * (height * 0.85), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Carte centrale
  const cardMargin = 70;
  const cardX = cardMargin;
  const cardY = 210;
  const cardW = width - cardMargin * 2;
  const cardH = height - cardY - 130;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  roundRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.restore();

  roundRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.lineWidth = 3;
  ctx.strokeStyle = passed ? "rgba(185,28,28,0.55)" : "rgba(255,255,255,0.18)";
  ctx.stroke();

  ctx.textAlign = "center";

  // Wordmark
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "700 30px sans-serif";
  ctx.fillText("⁉️  QUIZ BIBLIQUE MEF", width / 2, 120);

  // Médaillon central
  const medalCenterY = cardY + 165;
  const medalRadius = 110;
  const medalGradient = ctx.createRadialGradient(
    width / 2,
    medalCenterY,
    10,
    width / 2,
    medalCenterY,
    medalRadius
  );
  if (passed) {
    medalGradient.addColorStop(0, ACCENT_LIGHT);
    medalGradient.addColorStop(1, ACCENT);
  } else {
    medalGradient.addColorStop(0, "#26407a");
    medalGradient.addColorStop(1, "#101d3d");
  }
  ctx.save();
  ctx.shadowColor = passed ? "rgba(185,28,28,0.55)" : "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(width / 2, medalCenterY, medalRadius, 0, Math.PI * 2);
  ctx.fillStyle = medalGradient;
  ctx.fill();
  ctx.restore();

  ctx.font = "128px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(passed ? "🎉" : "📖", width / 2, medalCenterY + 8);
  ctx.textBaseline = "alphabetic";

  // Titre
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 58px sans-serif";
  ctx.fillText(passed ? "FÉLICITATIONS !" : "MERCI D'AVOIR PARTICIPÉ", width / 2, cardY + 360);

  // Nom du participant
  ctx.font = "600 42px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const afterName = wrapText(ctx, participantName, width / 2, cardY + 425, cardW - 160, 50);

  // Badge de score
  const badgeY = afterName + 55;
  const badgeH = 130;
  const badgeW = 420;
  const badgeX = width / 2 - badgeW / 2;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 28);
  ctx.fillStyle = passed ? "rgba(185,28,28,0.18)" : "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = passed ? ACCENT_LIGHT : "rgba(255,255,255,0.25)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "600 22px sans-serif";
  ctx.fillText("SCORE OBTENU", width / 2, badgeY + 38);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px sans-serif";
  ctx.fillText(`${score} / ${maxScore}`, width / 2, badgeY + 96);

  // Quiz + date
  const formattedDate = new Date(lessonDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 26px sans-serif";
  const afterQuiz = wrapText(
    ctx,
    quizTitle,
    width / 2,
    badgeY + badgeH + 65,
    cardW - 140,
    34
  );
  ctx.font = "400 22px sans-serif";
  ctx.fillText(formattedDate, width / 2, afterQuiz + 40);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 24px sans-serif";
  ctx.fillText("quiz.mefzogbadje.org", width / 2, height - 55);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de générer l'image."));
    }, "image/png");
  });
}
