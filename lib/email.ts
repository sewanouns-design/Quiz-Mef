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
      // Réponse fausse dont la correction a été masquée (tentatives restantes) :
      // on l'indique sans révéler la bonne réponse ni la justification.
      const hidden = a.isCorrect === false && a.correctOption === null && a.correctText === null;
      const justification = a.justification
        ? `<div style="margin-top:8px;padding:10px 12px;background-color:#f9fafb;border-radius:6px;color:#4b5563;font-size:13px;line-height:1.5;"><strong style="color:#374151;">Justification :</strong> ${escapeHtml(
            a.justification
          )}</div>`
        : "";
      return `
        <tr>
          <td style="padding:16px 4px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:700;color:#111827;font-size:14px;">${icon} Question ${i + 1}</div>
            <div style="margin:6px 0;color:#1f2937;font-size:14px;line-height:1.5;">${escapeHtml(a.question)}</div>
            <div style="font-size:13px;color:#374151;"><strong style="color:#111827;">Ta réponse :</strong> ${formatAnswer(a)}</div>
            ${
              hidden
                ? `<div style="margin-top:4px;font-size:13px;color:#9ca3af;">🔒 Réessaie pour découvrir la bonne réponse</div>`
                : a.type !== "open"
                  ? `<div style="margin-top:4px;font-size:13px;color:#374151;"><strong style="color:#111827;">Bonne réponse :</strong> ${formatCorrectAnswer(a)}</div>`
                  : ""
            }
            ${justification}
            <div style="margin-top:8px;font-size:12px;color:#9ca3af;">${a.pointsAwarded} / ${a.points} points</div>
          </td>
        </tr>
      `;
    })
    .join("");
}

/** Boîte de notice sobre (info neutre par défaut), rendue via une table avec bgcolor explicite pour rester fiable sous Gmail/Outlook en mode sombre. */
function noticeBox(html: string, tone: { bg: string; border: string; text: string }): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td bgcolor="${tone.bg}" style="background-color:${tone.bg};border:1px solid ${tone.border};border-radius:8px;padding:12px 16px;color:${tone.text};font-size:13px;line-height:1.5;">
          ${html}
        </td>
      </tr>
    </table>
  `;
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
  attemptsRemaining?: number;
  colors?: EmailColors;
}): string {
  const { participantName, quizTitle, score, maxScore, answers, cancelled, attemptNumber, attemptsRemaining } =
    params;
  const { primary } = params.colors ?? {
    primary: "#1a2e5a",
    accent: "#dc2626",
    accentDark: "#7f1414",
  };

  const passed = !cancelled && maxScore > 0 && score / maxScore >= 0.6;

  // Le score suit toujours un code couleur universel (vert = réussi, rouge =
  // échoué), indépendant des couleurs de marque du site : mélanger l'accent
  // de marque avec la sémantique réussite/échec est ce qui rendait l'email
  // confus (rouge de marque partout, y compris pour annoncer une réussite).
  const scoreTone = cancelled
    ? { bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }
    : passed
      ? { bg: "#ecfdf5", border: "#16a34a", text: "#15803d" }
      : { bg: "#fef2f2", border: "#dc2626", text: "#b91c1c" };
  const scoreLabel = cancelled ? "Score obtenu" : passed ? "🎉 Score obtenu — Réussi" : "Score obtenu";

  const cancelledNotice = cancelled
    ? noticeBox(
        `⚠️ <strong>Ce test a été annulé automatiquement</strong> car la page a été quittée à plusieurs reprises pendant le quiz. Voici tout de même le détail des réponses données jusque-là.`,
        { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" }
      )
    : "";

  const retryNotice =
    !cancelled && attemptNumber && attemptNumber > 1
      ? noticeBox(`🔁 Il s'agit de ta <strong>${attemptNumber}ᵉ tentative</strong> pour ce quiz.`, {
          bg: "#eff6ff",
          border: "#93c5fd",
          text: "#1e40af",
        })
      : "";

  const remainingNotice =
    !cancelled && attemptsRemaining !== undefined && attemptsRemaining > 0
      ? noticeBox(
          `Il te reste <strong>${attemptsRemaining} tentative${attemptsRemaining > 1 ? "s" : ""}</strong> pour atteindre la moyenne. Retente ta chance !`,
          { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af" }
        )
      : "";

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Tes résultats — Quiz Biblique</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(participantName)}, tu as obtenu ${score}/${maxScore} au quiz ${escapeHtml(quizTitle)}.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f5" style="background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td bgcolor="${primary}" style="background-color:${primary};padding:28px 24px;text-align:center;">
                <span style="font-size:22px;font-weight:800;color:#ffffff;">⁉️ Quiz Biblique</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px;color:#1f2937;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 8px 0;">Bonjour <strong>${escapeHtml(participantName)}</strong>,</p>
                <p style="margin:0 0 16px 0;">Voici tes résultats pour le quiz : <strong>${escapeHtml(quizTitle)}</strong></p>
                ${cancelledNotice}
                ${retryNotice}
                ${remainingNotice}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;">
                  <tr>
                    <td bgcolor="${scoreTone.bg}" align="center" style="background-color:${scoreTone.bg};border:2px solid ${scoreTone.border};border-radius:10px;padding:18px;">
                      <div style="font-size:13px;font-weight:600;color:${scoreTone.text};">${scoreLabel}</div>
                      <div style="font-size:34px;font-weight:800;color:${scoreTone.text};">${score} / ${maxScore}</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${buildResultsTableRows(answers)}
                </table>
                <p style="margin:24px 0 0 0;color:#374151;">Continue à sonder les Écritures chaque jour. « Sonde les écritures, car ce sont elles qui rendent témoignage de moi » (Jean 5:39).</p>
                <p style="margin:24px 0 0 0;font-size:13px;color:#9ca3af;">Quiz Biblique — quiz.mefzogbadje.org</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
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
  attemptsRemaining?: number;
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
    : params.attemptNumber && params.attemptNumber > 1
      ? `[${params.attemptNumber}e tentative] `
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

export const REENGAGEMENT_COPY: Record<
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
  const { accent } = params.colors ?? {
    primary: "#1a2e5a",
    accent: "#dc2626",
    accentDark: "#7f1414",
  };
  const { intro } = REENGAGEMENT_COPY[milestoneHours];

  // Priorité à la série interrompue (effet plus personnel), sinon le nombre
  // de participants déjà passés aujourd'hui (effet de groupe/FOMO).
  let statLine = "";
  if (streakDays && streakDays >= 2) {
    statLine = `Petit rappel : tu avais une série de <strong>${streakDays} jours</strong> d'affilée avant ta pause — reprends-la dès aujourd'hui.`;
  } else if (activeTodayCount && activeTodayCount > 0) {
    statLine = `Déjà <strong>${activeTodayCount} personne${activeTodayCount > 1 ? "s" : ""}</strong> ${activeTodayCount > 1 ? "ont" : "a"} répondu au quiz aujourd'hui.`;
  }

  // Volontairement une mise en page sobre, proche d'un email personnel
  // (pas de bannière colorée ni de gros bouton CTA), pour éviter que
  // les filtres de messagerie classent cette relance en "Promotions".
  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Quiz Biblique</title>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;">
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:0 auto;padding:16px;color:#222222;font-size:15px;line-height:1.6;">
      <p>Bonjour ${escapeHtml(participantName)},</p>
      <p>${intro}</p>
      ${statLine ? `<p>${statLine}</p>` : ""}
      <p>« Sonde les écritures, car ce sont elles qui rendent témoignage de moi » (Jean 5:39). Chaque quiz est une occasion de plus de méditer la Parole de Dieu.</p>
      <p>Tu peux reprendre le quiz du jour ici : <a href="${quizUrl}" style="color:${accent};">${quizUrl}</a></p>
      <p style="margin-top:24px;color:#555555;">— Quiz Biblique</p>
    </div>
  </body>
  </html>
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
