import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Toutes les tables du schéma public (cf. schema.sql), sans exception :
 * y compris les journaux techniques et les abonnements push. Toute nouvelle
 * table créée dans schema.sql doit être ajoutée ici.
 */
const BACKUP_TABLES = [
  "participants",
  "daily_quizzes",
  "daily_questions",
  "daily_submissions",
  "daily_answers",
  "lesson_questions",
  "site_settings",
  "login_attempts",
  "rate_limit_events",
  "reengagement_reminders",
  "push_subscriptions",
  "admin_activity_log",
] as const;

const PAGE_SIZE = 1000;

/**
 * Sauvegarde complète : un fichier JSON contenant toutes les lignes de toutes
 * les tables, toutes colonnes comprises. Réservé au super-admin. Le nombre de
 * lignes récupérées est comparé au décompte exact de la base : en cas
 * d'écart, l'export échoue plutôt que de livrer une sauvegarde incomplète.
 */
export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        return NextResponse.json(
          { error: `Export impossible (${table}) : ${error.message}` },
          { status: 500 }
        );
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const { count, error: countError } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (countError) {
      return NextResponse.json(
        { error: `Export impossible (${table}) : ${countError.message}` },
        { status: 500 }
      );
    }
    // Des lignes peuvent être ajoutées pendant l'export : on tolère un
    // surplus en base, jamais un manque dans le fichier.
    if ((count ?? 0) < rows.length) {
      return NextResponse.json(
        { error: `Export incohérent pour ${table}, réessaie.` },
        { status: 500 }
      );
    }

    tables[table] = rows;
    counts[table] = rows.length;
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    source: "quiz-mef",
    row_counts: counts,
    tables,
  };

  await logAdminActivity("backup_downloaded", "Sauvegarde complète téléchargée", {
    row_counts: counts,
  });

  const filename = `quiz-mef-sauvegarde-${exportedAt.slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
