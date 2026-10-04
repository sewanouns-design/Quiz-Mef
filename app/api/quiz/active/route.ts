import { NextResponse } from "next/server";
import { fetchActiveQuizzes } from "@/lib/active-quizzes";

export const dynamic = "force-dynamic";

/**
 * Liste des quiz actifs. `quiz` (le premier) est conservé pour les anciens
 * clients ; la page d'identification utilise `quizzes`.
 */
export async function GET() {
  const quizzes = await fetchActiveQuizzes();
  return NextResponse.json({ quizzes, quiz: quizzes[0] ?? null });
}
