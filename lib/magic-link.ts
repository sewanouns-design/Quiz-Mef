import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabase";

const SITE_URL = "https://quiz.mefzogbadje.org";

/** Crée un jeton de connexion à usage unique pour ce participant, valide `validMinutes`. */
export async function createMagicLinkToken(
  participantId: string,
  validMinutes: number
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("participant_login_tokens")
    .insert({ participant_id: participantId, token, expires_at: expiresAt });

  if (error) throw new Error(error.message);
  return token;
}

export function magicLinkUrl(token: string): string {
  return `${SITE_URL}/lien?token=${token}`;
}
