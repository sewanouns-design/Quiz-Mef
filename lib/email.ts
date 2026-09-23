import { Resend } from "resend";
import type { CorrectedAnswer } from "./types";

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
}): string {
  const { participantName, quizTitle, score, maxScore, answers, cancelled } = params;

  const cancelledNotice = cancelled
    ? `<div style="background:#fef2f2;border:2px solid #b91c1c;border-radius:8px;padding:14px;margin:16px 0;color:#7f1414;font-size:14px;">
        ⚠️ <strong>Ce test a été annulé automatiquement</strong> car la page a été quittée à plusieurs reprises pendant le quiz. Voici tout de même le détail des réponses données jusque-là.
      </div>`
    : "";

  return `
  <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;background:#f7f7f7;padding:24px;">
    <div style="background:#1a2e5a;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#c9a84c;margin:0;font-size:22px;">⁉️ Quiz Biblique MEF</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
      <p>Bonjour <strong>${escapeHtml(participantName)}</strong>,</p>
      <p>Voici tes résultats pour le quiz : <strong>${escapeHtml(quizTitle)}</strong></p>
      ${cancelledNotice}
      <div style="background:#f0ede1;border:2px solid #c9a84c;border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
        <div style="font-size:14px;color:#1a2e5a;">Score obtenu</div>
        <div style="font-size:32px;font-weight:700;color:#1a2e5a;">${score} / ${maxScore}</div>
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
  const html = buildResultsEmailHtml(params);

  const formattedDate = new Date(params.lessonDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subjectPrefix = params.cancelled ? "[Test annulé] " : "";
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
