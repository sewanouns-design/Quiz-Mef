import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOriginRequest } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";
import { getClientIp, isRateLimited, recordRateLimitEvent } from "@/lib/rate-limit";
import { createMagicLinkToken, magicLinkUrl } from "@/lib/magic-link";
import { sendMagicLinkEmail } from "@/lib/email";

const RATE_LIMIT_ROUTE = "magic-link";
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

// Limite distincte, par adresse email ciblée plutôt que par IP : empêche
// qu'on spamme la boîte mail de quelqu'un d'autre depuis plusieurs appareils.
const EMAIL_RATE_LIMIT_ROUTE = "magic-link-email";
const EMAIL_RATE_LIMIT_MAX = 3;
const EMAIL_RATE_LIMIT_WINDOW_MINUTES = 60;

const VALID_MINUTES = 30;

// Réponse volontairement identique, que l'email corresponde ou non à un
// participant existant : ne jamais confirmer/infirmer l'existence d'un
// compte à partir d'une adresse email (évite l'énumération d'emails).
const GENERIC_MESSAGE =
  "Si cette adresse est associée à un profil, un lien de connexion vient d'être envoyé.";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (await isRateLimited(ip, RATE_LIMIT_ROUTE, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Le format de l'email n'est pas valide." }, { status: 400 });
  }

  await recordRateLimitEvent(ip, RATE_LIMIT_ROUTE);

  if (
    await isRateLimited(
      email.toLowerCase(),
      EMAIL_RATE_LIMIT_ROUTE,
      EMAIL_RATE_LIMIT_MAX,
      EMAIL_RATE_LIMIT_WINDOW_MINUTES
    )
  ) {
    // Même message générique : ne révèle pas qu'on a atteint une limite
    // spécifique à cet email.
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
  await recordRateLimitEvent(email.toLowerCase(), EMAIL_RATE_LIMIT_ROUTE);

  try {
    const supabase = getSupabaseAdmin();
    // Plusieurs participants peuvent partager un même email (doublons
    // créés avant ce système) : on cible le plus récent, le plus probable
    // pour désigner l'appareil actuellement utilisé par cette personne.
    const { data: participant } = await supabase
      .from("participants")
      .select("id, name, email")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (participant?.email) {
      const token = await createMagicLinkToken(participant.id, VALID_MINUTES);
      await sendMagicLinkEmail({
        to: participant.email,
        participantName: participant.name,
        magicLinkUrl: magicLinkUrl(token),
      });
    }
  } catch (err) {
    // Ne jamais remonter le détail au client (évite l'énumération) : on
    // journalise seulement côté serveur.
    console.error("Erreur lors de l'envoi du lien magique :", err);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
