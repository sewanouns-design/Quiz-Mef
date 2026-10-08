import { NextResponse } from "next/server";
import { getSiteSettings, getVerseGameAvailability } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/** Point d'accès public : dit si "Trouve le verset" est jouable en ce
 * moment (désactivé par l'admin, ou hors créneau horaire). */
export async function GET() {
  const settings = await getSiteSettings();
  const availability = getVerseGameAvailability(settings);
  return NextResponse.json(availability);
}
