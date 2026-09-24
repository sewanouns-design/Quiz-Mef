import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { regradeQuiz } from "@/lib/regrade";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  try {
    const result = await regradeQuiz(params.quizId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors du recalcul." },
      { status: 500 }
    );
  }
}
