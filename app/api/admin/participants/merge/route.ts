import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";
import { mergeParticipants } from "@/lib/participant-merge";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { targetId, sourceIds, fields } = body ?? {};

  if (
    typeof targetId !== "string" ||
    !Array.isArray(sourceIds) ||
    sourceIds.length === 0 ||
    !sourceIds.every((id) => typeof id === "string") ||
    sourceIds.includes(targetId)
  ) {
    return NextResponse.json(
      { error: "targetId et sourceIds (sans doublon avec targetId) sont requis" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: namesData } = await supabase
    .from("participants")
    .select("id, name")
    .in("id", [targetId, ...sourceIds]);
  const targetName = namesData?.find((p) => p.id === targetId)?.name ?? "?";
  const sourceNames = (namesData ?? []).filter((p) => p.id !== targetId).map((p) => p.name);

  let reassigned = 0;
  let deletedDuplicates = 0;
  try {
    const result = await mergeParticipants(supabase, targetId, sourceIds);
    reassigned = result.reassigned;
    deletedDuplicates = result.deletedDuplicates;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur lors de la fusion." },
      { status: 500 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof fields?.name === "string" && fields.name.trim()) updates.name = fields.name.trim();
  if (typeof fields?.address === "string" && fields.address.trim()) updates.address = fields.address.trim();
  if (fields?.email !== undefined) updates.email = fields.email || null;
  if (fields?.whatsapp !== undefined) updates.whatsapp = fields.whatsapp || null;

  let target = null;
  if (Object.keys(updates).length > 0) {
    const { data, error: targetError } = await supabase
      .from("participants")
      .update(updates)
      .eq("id", targetId)
      .select()
      .single();
    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }
    target = data;
  }

  await logAdminActivity(
    "participants_merged",
    `${sourceNames.join(", ") || sourceIds.length + " fiche(s)"} fusionné(s) dans ${targetName}`,
    { targetId, sourceIds, reassigned, deletedDuplicates }
  );

  return NextResponse.json({ ok: true, participant: target, reassigned, deletedDuplicates });
}
