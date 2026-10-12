import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const BUCKET = "quiz-sources";

type SourceRow = {
  id: string;
  name: string;
  file_size_bytes: number;
  mime_type: string;
  lesson_start: number;
  quarter_start: string | null;
  quarter_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function safeFilename(name: string): string {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.replace(/^[-.]+|[-.]+$/g, "") || "livret.pdf";
}

function parseOptionalDate(value: FormDataEntryValue | null, label: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} doit être au format AAAA-MM-JJ.`);
  }
  return value;
}

async function extractText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  const text = result.text.trim();
  if (!text) throw new Error("Le PDF ne contient pas de texte exploitable.");
  return text;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("lesson_sources")
    .select(
      "id,name,file_size_bytes,mime_type,lesson_start,quarter_start,quarter_end,is_active,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: (data ?? []) as SourceRow[] });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sélectionne un fichier PDF." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "Le PDF doit faire entre 1 octet et 10 Mo." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Le fichier doit être au format PDF." }, { status: 400 });
  }

  const lessonStartRaw = form.get("lessonStart");
  const lessonStart = Number(lessonStartRaw || 7);
  if (!Number.isInteger(lessonStart) || lessonStart < 1 || lessonStart > 100) {
    return NextResponse.json({ error: "La première leçon doit être un entier entre 1 et 100." }, { status: 400 });
  }

  let quarterStart: string | null;
  let quarterEnd: string | null;
  try {
    quarterStart = parseOptionalDate(form.get("quarterStart"), "La date de début");
    quarterEnd = parseOptionalDate(form.get("quarterEnd"), "La date de fin");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dates invalides." },
      { status: 400 }
    );
  }
  if (quarterStart && quarterEnd && quarterStart > quarterEnd) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let sourceText: string;
  try {
    sourceText = await extractText(buffer);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d’extraire le texte du PDF." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const filePath = `trimesters/${Date.now()}-${safeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: `Stockage du PDF impossible : ${uploadError.message}` }, { status: 500 });
  }

  let insertedId: string | null = null;
  try {
    const { data: inserted, error: insertError } = await supabase
      .from("lesson_sources")
      .insert({
        name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
        mime_type: "application/pdf",
        lesson_start: lessonStart,
        quarter_start: quarterStart,
        quarter_end: quarterEnd,
        source_text: sourceText,
        is_active: false,
      })
      .select("id")
      .single();
    if (insertError || !inserted) throw new Error(insertError?.message ?? "Création de la source impossible.");
    insertedId = inserted.id;

    const { error: deactivateError } = await supabase
      .from("lesson_sources")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .neq("id", inserted.id);
    if (deactivateError) throw new Error(deactivateError.message);

    const { data: active, error: activateError } = await supabase
      .from("lesson_sources")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", inserted.id)
      .select("id,name,file_size_bytes,lesson_start,quarter_start,quarter_end,is_active,created_at,updated_at")
      .single();
    if (activateError || !active) throw new Error(activateError?.message ?? "Activation de la source impossible.");

    await logAdminActivity("settings_updated", `Source trimestrielle importée : ${file.name}`, {
      lessonSourceId: inserted.id,
      fileSizeBytes: file.size,
      lessonStart,
      extractedCharacters: sourceText.length,
    });

    return NextResponse.json({ source: active }, { status: 201 });
  } catch (error) {
    if (insertedId) await supabase.from("lesson_sources").delete().eq("id", insertedId);
    await supabase.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d’enregistrer la source." },
      { status: 500 }
    );
  }
}

async function getSourceById(id: string) {
  const supabase = getSupabaseAdmin();
  return supabase
    .from("lesson_sources")
    .select("id,name,file_path,lesson_start,quarter_start,quarter_end,is_active,file_size_bytes")
    .eq("id", id)
    .maybeSingle();
}

function parseJsonDate(value: unknown, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} doit être au format AAAA-MM-JJ.`);
  }
  return value;
}

export async function PUT(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Identifiant de source manquant." }, { status: 400 });

  let quarterStart: string | null | undefined;
  let quarterEnd: string | null | undefined;
  try {
    quarterStart = parseJsonDate(body.quarterStart, "La date de début");
    quarterEnd = parseJsonDate(body.quarterEnd, "La date de fin");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dates invalides." }, { status: 400 });
  }
  if (quarterStart && quarterEnd && quarterStart > quarterEnd) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200) {
      return NextResponse.json({ error: "Le nom doit contenir entre 1 et 200 caractères." }, { status: 400 });
    }
    updates.name = body.name.trim();
  }
  if (body.lessonStart !== undefined) {
    const lessonStart = Number(body.lessonStart);
    if (!Number.isInteger(lessonStart) || lessonStart < 1 || lessonStart > 100) {
      return NextResponse.json({ error: "La première leçon doit être un entier entre 1 et 100." }, { status: 400 });
    }
    updates.lesson_start = lessonStart;
  }
  if (quarterStart !== undefined) updates.quarter_start = quarterStart;
  if (quarterEnd !== undefined) updates.quarter_end = quarterEnd;

  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await getSourceById(id);
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Source introuvable." }, { status: 404 });

  const wantsActive = body.isActive === true;
  if (body.isActive === false && current.is_active) {
    const { count, error: countError } = await supabase
      .from("lesson_sources")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Impossible de désactiver la seule source active. Active d’abord une autre source." },
        { status: 409 }
      );
    }
    updates.is_active = false;
  }

  if (wantsActive) {
    const { error: deactivateError } = await supabase
      .from("lesson_sources")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .neq("id", id);
    if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 });
    updates.is_active = true;
  }

  const { data, error } = await supabase
    .from("lesson_sources")
    .update(updates)
    .eq("id", id)
    .select("id,name,file_size_bytes,mime_type,lesson_start,quarter_start,quarter_end,is_active,created_at,updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Modification impossible." }, { status: 500 });

  await logAdminActivity("settings_updated", `Source trimestrielle modifiée : ${data.name}`, {
    lessonSourceId: id,
    isActive: data.is_active,
  });
  return NextResponse.json({ source: data });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Identifiant de source manquant." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: source, error: sourceError } = await getSourceById(id);
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: "Source introuvable." }, { status: 404 });
  if (source.is_active) {
    return NextResponse.json(
      { error: "Cette source est active. Active d’abord une autre source avant de la supprimer." },
      { status: 409 }
    );
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([source.file_path]);
  if (storageError) return NextResponse.json({ error: `Suppression du PDF impossible : ${storageError.message}` }, { status: 500 });

  const { error: deleteError } = await supabase.from("lesson_sources").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await logAdminActivity("settings_updated", `Source trimestrielle supprimée : ${source.name}`, {
    lessonSourceId: id,
  });
  return NextResponse.json({ deleted: true, id });
}
