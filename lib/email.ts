import { Resend } from "resend";
import { getSiteSettings } from "./site-settings";
import type { CorrectedAnswer } from "./types";

interface EmailColors {
  primary: string;
  accent: string;
  accentDark: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAnswer(answer: CorrectedAnswer): string {
  if (answer.type === "mcq" || answer.type === "true_false") {
    if (answer.participantSelectedOption === null || answer.participantSelectedOption === undefined) {
      return "(pas de réponse)";
    }
    return escapeHtml(answer.options?.[answer.participantSelectedOption] ?? "—");
  }
  return escapeHtml(answer.participantAnswerText || "(pas de réponse)");
}

function formatCorrectAnswer(answer: CorrectedAnswer): string {
  if (answer.type === "mcq" || answer.type === "true_false") {
    if (answer.correctOption === null || answer.correctOption === undefined) return "—";
    return escapeHtml(answer.options?.[answer.correctOption] ?? "—");
  }
  if (answer.type === "open") return "—";
  return escapeHtml(answer.correctText || "—");
}

function buildResultsTableRows(answers: CorrectedAnswer[]): string {
  return answers
    .map((a, i) => {
      const icon = a.type === "open" ? "✍️" : a.isCorrect ? "✅" : "❌";
      const justification = a.justification
        ? `<div style="margin-top:6px;color:#555;font-size:13px;"><strong>Justification :</strong> ${escapeHtml(
            a.justification
          )}</div>`
        : "";
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e5e5;vertical-align:top;">
            <div style="font-weight:600;color:#1a2e5a;">${icon} Question ${i + 1}</div>
            <div style="margin:4px 0;">${escapeHtml(a.question)}</div>
            <div style="font-size:13px;"><strong>Ta réponse :</strong> ${formatAnswer(a)}</div>
            ${
              a.type !== "open"
                ? `<div style="font-size:13px;"><strong>Bonne réponse :</strong> ${formatCorrectAnswer(a)}</div>`
                : ""
            }
            ${justification}
            <div style="margin-top:6px;font-size:12px;color:#888;">${a.pointsAwarded} / ${a.points} points</div>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function buildResultsEmailHtml(params: {
  participantName: string;
  quizTitle: string;
  lessonDate: string;
  score: number;
  maxScore: number;
  answers: CorrectedAnswer[];
  cancelled?: boolean;
  attemptNumber?: number;
  colors?: EmailColors;
}): string {
  const { participantName, quizTitle, score, maxScore, answers, cancelled, attemptNumber } =
    params;
  const { primary, accent, accentDark } = params.colors ?? {
    primary: "#1a2e5a",
    accent: "#dc2626",
    accentDark: "#7f1414",
  };

  const cancelledNotice = cancelled
    ? `<div style="background:${accent}15;border:2px solid ${accentDark};border-radius:8px;padding:14px;margin:16px 0;color:${accentDark};font-size:14px;">
        ⚠️ <strong>Ce test a été annulé automatiquement</strong> car la page a été quittée à plusieurs reprises pendant le quiz. Voici tout de même le détail des réponses données jusque-là.
      </div>`
    : "";

  const retryNotice =
    !cancelled && attemptNumber === 2
      ? `<div style="background:${accent}15;border:1px solid ${accent};border-radius:8px;padding:10px 14px;margin:16px 0;color:${primary};font-size:13px;">
          🔁 Il s'agit de ta <strong>2ᵉ tentative</strong> pour ce quiz.
        </div>`
      : "";

  return `
  <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;background:#f7f7f7;padding:24px;">
    <div style="background:${primary};padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:${accent};margin:0;font-size:22px;">⁉️ Quiz Biblique MEF</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
      <p>Bonjour <strong>${escapeHtml(participantName)}</strong>,</p>
      <p>Voici tes résultats pour le quiz : <strong>${escapeHtml(quizTitle)}</strong></p>
      ${cancelledNotice}
      ${retryNotice}
      <div style="background:${accent}15;border:2px solid ${accent};border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
        <div style="font-size:14px;color:${primary};">Score obtenu</div>
        <div style="font-size:32px;font-weight:700;color:${primary};">${score} / ${maxScore}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${buildResultsTableRows(answers)}
      </table>
      <p style="margin-top:24px;">Continue à sonder les Écritures chaque jour. « Sonde les écritures, car ce sont elles qui rendent témoignage de moi » (Jean 5:39).</p>
      <p style="margin-top:24px;font-size:13px;color:#888;">Quiz Biblique MEF — quiz.mefzogbadje.org</p>
    </div>
  </div>
  `;
}

export async function sendResultsEmail(params: {
  to: string;
  participantName: string;
  quizTitle: string;
  lessonDate: string;
  score: number;
  maxScore: number;
  answers: CorrectedAnswer[];
  cancelled?: boolean;
  attemptNumber?: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      `RESEND_API_KEY ou RESEND_FROM_EMAIL manquant (apiKey: ${apiKey ? "présent" : "absent"}, from: ${from ? "présent" : "absent"}), email non envoyé.`
    );
    return;
  }

  const resend = new Resend(apiKey);
  const settings = await getSiteSettings();
  const html = buildResultsEmailHtml({
    ...params,
    colors: {
      primary: settings.color_primary,
      accent: settings.color_accent,
      accentDark: settings.color_accent_dark,
    },
  });

  const formattedDate = new Date(params.lessonDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subjectPrefix = params.cancelled
    ? "[Test annulé] "
    : params.attemptNumber === 2
      ? "[2e tentative] "
      : "";
  const result = await resend.emails.send({
    from,
    to: params.to,
    subject: `${subjectPrefix}Tes résultats — Quiz Biblique du ${formattedDate}`,
    html,
  });

  if (result.error) {
    throw new Error(`Resend a refusé l'envoi : ${result.error.name} — ${result.error.message}`);
  }

  console.log(`Email de résultats envoyé à ${params.to} (id: ${result.data?.id})`);
}

const REENGAGEMENT_COPY: Record<
  24 | 48 | 72,
  { subject: string; intro: string }
> = {
  24: {
    subject: "On t'a gardé ta question du jour 📖",
    intro:
      "Hier, à pareil moment, tu répondais à ton quiz. Aujourd'hui, une nouvelle question t'attend — ça prend moins de 2 minutes.",
  },
  48: {
    subject: "2 minutes pour ne pas perdre le fil 🙏",
    intro: "Deux jours sans quiz, mais ta série n'est pas perdue si tu reviens maintenant.",
  },
  72: {
    subject: "Dernier rappel : ton quiz t'attend encore 🕊️",
    intro:
      "On ne veut pas te harceler, mais on tenait à te dire : la communauté continue de sonder les Écritures chaque jour, et ta place y est.",
  },
};

function buildReengagementEmailHtml(params: {
  participantName: string;
  milestoneHours: 24 | 48 | 72;
  quizUrl: string;
  colors?: EmailColors;
  streakDays?: number;
  activeTodayCount?: number;
}): string {
  const { participantName, milestoneHours, quizUrl, streakDays, activeTodayCount } = params;
  const { primary, accent } = params.colors ?? {
    primary: "#1a2e5a",
    accent: "#dc2626",
    accentDark: "#7f1414",
  };
  const { intro } = REENGAGEMENT_COPY[milestoneHours];

  // Priorité à la série interrompue (effet plus personnel), sinon le nombre
  // de participants déjà passés aujourd'hui (effet de groupe/FOMO).
  let statLine = "";
  if (streakDays && streakDays >= 2) {
    statLine = `🔥 Tu avais une série de <strong>${streakDays} jours</strong> d'affilée avant ta pause — reprends-la dès aujourd'hui !`;
  } else if (activeTodayCount && activeTodayCount > 0) {
    statLine = `👥 Déjà <strong>${activeTodayCount} personne${activeTodayCount > 1 ? "s" : ""}</strong> ${activeTodayCount > 1 ? "ont" : "a"} répondu au quiz aujourd'hui.`;
  }

  const statBlock = statLine
    ? `<div style="background:${accent}15;border:1px solid ${accent};border-radius:8px;padding:12px 16px;margin:20px 0;color:${primary};font-size:14px;text-align:center;">${statLine}</div>`
    : "";

  return `
  <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;background:#f7f7f7;padding:24px;">
    <div style="background:${primary};padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:${accent};margin:0;font-size:22px;">⁉️ Quiz Biblique MEF</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
      <p>Bonjour <strong>${escapeHtml(participantName)}</strong>,</p>
      <p>${intro}</p>
      ${statBlock}
      <p>« Sonde les écritures, car ce sont elles qui rendent témoignage de moi » (Jean 5:39). Chaque quiz est une occasion de plus de méditer la Parole de Dieu.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${quizUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;">
          Reprendre le quiz du jour →
        </a>
      </div>
      <p style="margin-top:24px;font-size:13px;color:#888;">Quiz Biblique MEF — quiz.mefzogbadje.org</p>
    </div>
  </div>
  `;
}

export async function sendReengagementEmail(params: {
  to: string;
  participantName: string;
  milestoneHours: 24 | 48 | 72;
  quizUrl: string;
  streakDays?: number;
  activeTodayCount?: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("RESEND_API_KEY ou RESEND_FROM_EMAIL manquant, relance non envoyée.");
    return;
  }

  const resend = new Resend(apiKey);
  const settings = await getSiteSettings();
  const html = buildReengagementEmailHtml({
    ...params,
    colors: {
      primary: settings.color_primary,
      accent: settings.color_accent,
      accentDark: settings.color_accent_dark,
    },
  });
  const { subject } = REENGAGEMENT_COPY[params.milestoneHours];

  const result = await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(`Resend a refusé l'envoi : ${result.error.name} — ${result.error.message}`);
  }

  console.log(
    `Relance ${params.milestoneHours}h envoyée à ${params.to} (id: ${result.data?.id})`
  );
}
