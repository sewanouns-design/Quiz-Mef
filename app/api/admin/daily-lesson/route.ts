import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { getLessonForDate, getLocalLessonDate, extractDailyLesson } from "@/lib/daily-lesson";
import { logAdminActivity } from "@/lib/admin-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 80_000;

type ScriptureVerse = { reference: string; text: string };

type LessonOverrideBody = {
  id?: unknown;
  lessonDate?: unknown;
  lessonNumber?: unknown;
  title?: unknown;
  reference?: unknown;
  scriptureVerses?: unknown;
  body?: unknown;
  essential?: unknown;
  prayer?: unknown;
  isVisible?: unknown;
};

function parseDate(value: unknown): string {
  const date = typeof value === "string" && DATE_PATTERN.test(value) ? value : getLocalLessonDate();
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("La date de la leçon est invalide.");
  }
  return date;
}

function text(value: unknown, label: string, max = MAX_TEXT, required = false): string {
  if (typeof value !== "string") {
    if (required) throw new Error(`${label} est obligatoire.`);
    return "";
  }
  const result = value.trim();
  if (required && !result) throw new Error(`${label} est obligatoire.`);
  if (result.length > max) throw new Error(`${label} est trop long.`);
  return result;
}

function parseScriptureVerses(value: unknown): ScriptureVerse[] {
  if (!Array.isArray(value) || value.length > 60) {
    throw new Error("Le texte biblique doit contenir au maximum 60 passages.");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Passage biblique ${index + 1} invalide.`);
    const reference = text("reference" in item ? item.reference : "", `Référence biblique ${index + 1}`, 300, true);
    const verseText = text("text" in item ? item.text : "", `Texte biblique ${index + 1}`, 8_000, true);
    return { reference, text: verseText };
  });
}

function publicOverride(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: row.id,
    lessonDate: row.lesson_date,
    lessonNumber: row.lesson_number,
    title: row.title,
    reference: row.reference ?? "",
    scriptureVerses: Array.isArray(row.scripture_verses) ? row.scripture_verses : [],
    body: row.body ?? "",
    essential: row.essential ?? "",
    prayer: row.prayer ?? "",
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOverride(supabase: ReturnType<typeof getSupabaseAdmin>, lessonDate: string) {
  return supabase
    .from("daily_lesson_overrides")
    .select("id, lesson_date, lesson_number, title, reference, scripture_verses, body, essential, prayer, is_visible, created_at, updated_at")
    .eq("lesson_date", lessonDate)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let lessonDate: string;
  try {
    lessonDate = parseDate(new URL(request.url).searchParams.get("date"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Date invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const [{ data: override, error: overrideError }, { data: source, error: sourceError }, { data: overrides, error: listError }] = await Promise.all([
    getOverride(supabase, lessonDate),
    supabase
      .from("lesson_sources")
      .select("source_text, lesson_start, updated_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_lesson_overrides")
      .select("id, lesson_date, lesson_number, title, reference, scripture_verses, body, essential, prayer, is_visible, created_at, updated_at")
      .order("lesson_date", { ascending: false })
      .limit(100),
  ]);

  if (overrideError || sourceError || listError) {
    return NextResponse.json({ error: overrideError?.message ?? sourceError?.message ?? listError?.message ?? "Lecture impossible." }, { status: 500 });
  }

  const sourceLesson = source?.source_text
    ? extractDailyLesson(source.source_text, lessonDate, source.lesson_start ?? 1, source.updated_at ?? null)
    : null;
  const sourceLessonWithVerses = (await getLessonForDate(lessonDate, { ignoreOverride: true })) ?? sourceLesson;
  const effectiveLesson = override ? await getLessonForDate(lessonDate) : sourceLessonWithVerses;

  return NextResponse.json({
    lessonDate,
    lesson: effectiveLesson,
    sourceLesson: sourceLessonWithVerses,
    override: publicOverride(override as Record<string, unknown> | null),
    overrides: (overrides ?? []).map((row) => publicOverride(row as Record<string, unknown>)),
  });
}

export async function PUT(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as LessonOverrideBody;
  let lessonDate: string;
  try {
    lessonDate = parseDate(body.lessonDate);
    const lessonNumber = Number(body.lessonNumber);
    if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 100) {
      throw new Error("Le numéro de leçon doit être un entier entre 1 et 100.");
    }
    const title = text(body.title, "Le titre", 500, true);
    const reference = text(body.reference, "La référence", 1_000);
    const scriptureVerses = parseScriptureVerses(body.scriptureVerses ?? []);
    const lessonBody = text(body.body, "Le développement");
    const essential = text(body.essential, "Le point essentiel", 8_000);
    const prayer = text(body.prayer, "La prière", 8_000);
    const isVisible = body.isVisible !== false;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("daily_lesson_overrides")
      .upsert(
        {
          lesson_date: lessonDate,
          lesson_number: lessonNumber,
          title,
          reference,
          scripture_verses: scriptureVerses,
          body: lessonBody,
          essential,
          prayer,
          is_visible: isVisible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lesson_date" }
      )
      .select("id, lesson_date, lesson_number, title, reference, scripture_verses, body, essential, prayer, is_visible, created_at, updated_at")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Enregistrement impossible.");
    await logAdminActivity("daily_lesson_updated", `Leçon du ${lessonDate} personnalisée`, {
      lessonDate,
      lessonNumber,
      isVisible,
    });
    return NextResponse.json({ override: publicOverride(data as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Données invalides." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as LessonOverrideBody;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || typeof body.isVisible !== "boolean") {
    return NextResponse.json({ error: "Identifiant et état de visibilité requis." }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_lesson_overrides")
    .update({ is_visible: body.isVisible, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, lesson_date, lesson_number, title, reference, scripture_verses, body, essential, prayer, is_visible, created_at, updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Modification impossible." }, { status: 500 });

  await logAdminActivity("daily_lesson_visibility_changed", `Leçon du ${data.lesson_date} ${body.isVisible ? "affichée" : "masquée"}`, {
    lessonDate: data.lesson_date,
    isVisible: body.isVisible,
  });
  return NextResponse.json({ override: publicOverride(data as Record<string, unknown>) });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as LessonOverrideBody;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Identifiant de personnalisation manquant." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: current, error: currentError } = await supabase
    .from("daily_lesson_overrides")
    .select("id, lesson_date, title")
    .eq("id", id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Personnalisation introuvable." }, { status: 404 });

  const { error } = await supabase.from("daily_lesson_overrides").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminActivity("daily_lesson_deleted", `Personnalisation de la leçon du ${current.lesson_date} supprimée`, {
    lessonDate: current.lesson_date,
    restoredFromSource: true,
  });
  return NextResponse.json({ deleted: true, lessonDate: current.lesson_date });
}
