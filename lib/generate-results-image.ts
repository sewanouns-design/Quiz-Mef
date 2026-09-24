// Cette image n'est générée que pour un score réussi (>= 60%) — voir
// app/quiz/[quizId]/resultats/page.tsx, qui n'appelle cette fonction que
// lorsque `passed` est vrai. Pas de variante "échec" ici.
export interface ResultsImageParams {
  participantName: string;
  score: number;
  maxScore: number;
  quizTitle: string;
  lessonDate: string;
  attemptNumber?: number;
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
  const { participantName, score, maxScore, quizTitle, lessonDate, attemptNumber } = params;
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

  // En-tête : nom du site à gauche, adresse à droite
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "800 30px sans-serif";
  ctx.fillText("⁉️ QUIZ BIBLIQUE", 64, 90);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 24px sans-serif";
  ctx.fillText("quiz.mefzogbadje.org", width - 64, 88);

  ctx.textAlign = "center";

  // Grand texte fantôme (contour) en fond, façon affiche
  ctx.save();
  ctx.translate(width / 2, 330);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.font = "900 128px sans-serif";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.strokeText("FÉLICITATIONS", 0, 0);
  ctx.restore();

  // Titre
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 84px sans-serif";
  ctx.fillText("FÉLICITATIONS !", width / 2, 400);

  let cursorY = 400;

  // Pastille "2e tentative" (uniquement si applicable)
  if (attemptNumber === 2) {
    const label = "🔁 2ᵉ TENTATIVE";
    ctx.font = "700 24px sans-serif";
    const labelWidth = ctx.measureText(label).width + 48;
    const pillY = cursorY + 40;
    roundRect(ctx, width / 2 - labelWidth / 2, pillY, labelWidth, 56, 28);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, width / 2, pillY + 37);
    cursorY = pillY + 56;
  }

  // Médaillon
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
  ctx.fillText("🎉", width / 2, medalCenterY + 6);
  ctx.textBaseline = "alphabetic";

  // Nom du participant
  ctx.font = "600 44px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const afterName = wrapText(ctx, participantName, width / 2, medalCenterY + 150, width - 220, 52);

  // Badge de score
  const badgeY = afterName + 55;
  const badgeH = 130;
  const badgeW = 420;
  const badgeX = width / 2 - badgeW / 2;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 28);
  ctx.fillStyle = "rgba(185,28,28,0.18)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ACCENT_LIGHT;
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
  const afterQuiz = wrapText(ctx, quizTitle, width / 2, badgeY + badgeH + 65, width - 220, 34);
  ctx.font = "400 22px sans-serif";
  ctx.fillText(formattedDate, width / 2, afterQuiz + 40);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de générer l'image."));
    }, "image/png");
  });
}
