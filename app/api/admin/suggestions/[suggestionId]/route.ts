import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_RESPONSE_LENGTH = 2000;

/**
 * Permet à l'admin de marquer une suggestion comme "prise en compte"
 * et/ou d'y laisser une réponse libre — les deux sont visibles pour le
 * participant sur sa page de résultats.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { suggestionId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { acknowledged, adminResponse } = body ?? {};

  const updates: Record<string, unknown> = {};
  if (acknowledged !== undefined) {
    updates.acknowledged = Boolean(acknowledged);
  }
  if (adminResponse !== undefined) {
    const trimmed = typeof adminResponse === "string" ? adminResponse.trim() : "";
    updates.admin_response = trimmed ? trimmed.slice(0, MAX_RESPONSE_LENGTH) : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }
  updates.responded_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("suggestions")
    .update(updates)
    .eq("id", params.suggestionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestion: data });
}
