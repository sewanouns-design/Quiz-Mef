import { Resend } from "resend";
import { getSiteSettings } from "./site-settings";

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

function buildMagicLinkEmailHtml(params: {
  participantName: string;
  magicLinkUrl: string;
  colors?: EmailColors;
}): string {
  const { participantName, magicLinkUrl } = params;
  const { accent } = params.colors ?? {
    primary: "#1a2e5a",
    accent: "#dc2626",
    accentDark: "#7f1414",
  };

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
      <p>Clique sur ce lien pour retrouver ton profil sur cet appareil, sans tout ressaisir :</p>
      <p><a href="${magicLinkUrl}" style="color:${accent};">${magicLinkUrl}</a></p>
      <p style="color:#555555;font-size:13px;">Ce lien est à usage unique et expire dans 30 minutes. Si tu n'as rien demandé, ignore cet email.</p>
      <p style="margin-top:24px;color:#555555;">— Quiz Biblique</p>
    </div>
  </body>
  </html>
  `;
}

/**
 * Envoie un lien de connexion à usage unique (voir participant_login_tokens) :
 * reconnaît le participant sur un nouvel appareil/navigateur sans compte ni
 * mot de passe, en réécrivant son device_key d'origine dans le localStorage
 * de ce nouvel appareil au clic (voir app/lien/page.tsx).
 */
export async function sendMagicLinkEmail(params: {
  to: string;
  participantName: string;
  magicLinkUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("RESEND_API_KEY ou RESEND_FROM_EMAIL manquant, lien magique non envoyé.");
    return;
  }

  const resend = new Resend(apiKey);
  const settings = await getSiteSettings();
  const html = buildMagicLinkEmailHtml({
    ...params,
    colors: {
      primary: settings.color_primary,
      accent: settings.color_accent,
      accentDark: settings.color_accent_dark,
    },
  });

  const result = await resend.emails.send({
    from,
    to: params.to,
    subject: "Ton lien pour retrouver ton profil — Quiz Biblique",
    html,
  });

  if (result.error) {
    throw new Error(`Resend a refusé l'envoi : ${result.error.name} — ${result.error.message}`);
  }

  console.log(`Lien magique envoyé à ${params.to} (id: ${result.data?.id})`);
}
