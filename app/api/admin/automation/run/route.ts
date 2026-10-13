import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const webhookUrl = process.env.MEF_MANUAL_TRIGGER_URL;
  const webhookToken = process.env.MEF_MANUAL_TRIGGER_TOKEN;
  if (!webhookUrl || !webhookToken) {
    return NextResponse.json(
      { error: "Le déclencheur manuel n’est pas configuré sur le serveur." },
      { status: 503 }
    );
  }

  const requestedAt = new Date().toISOString();
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "manual_quiz_automation",
        token: webhookToken,
        requestedAt,
        source: "admin_dashboard",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Déclencheur manuel refusé", response.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "Le service d’automatisation a refusé le lancement." },
        { status: 502 }
      );
    }

    await logAdminActivity("settings_updated", "Lancement manuel de l’automatisation des quiz demandé", {
      requestedAt,
      trigger: "admin_dashboard",
    });

    return NextResponse.json({
      accepted: true,
      message: "La génération a été lancée. Les quiz manquants seront créés en arrière-plan.",
      requestedAt,
    });
  } catch (error) {
    console.error("Erreur du déclencheur manuel", error);
    return NextResponse.json(
      { error: "Impossible de joindre le service d’automatisation." },
      { status: 502 }
    );
  }
}
