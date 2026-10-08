import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

const CHUNK_SIZE = 500;

// Ordre de restauration = ordre des dépendances (clés étrangères) : une
// table n'est restaurée qu'une fois celles qu'elle référence déjà en place.
const RESTORE_ORDER = [
  "site_settings",
  "bible_verses",
  "verse_game_scores",
  "verse_game_progress",
  "site_updates",
  "daily_quizzes",
  "daily_questions",
  "participants",
  "daily_submissions",
  "daily_answers",
  "lesson_questions",
  "lesson_question_replies",
  "suggestions",
  "admin_activity_log",
] as const;

/**
 * Restaure une sauvegarde exportée par /api/admin/backup/export.
 *
 * Toujours additif : chaque ligne est upsertée par son id (ajoutée si
 * nouvelle, mise à jour si l'id existe déjà). Rien n'est jamais supprimé —
 * une ligne créée après la sauvegarde reste intacte même si elle n'est pas
 * dans le fichier importé. C'est volontaire : un bouton de restauration ne
 * doit jamais pouvoir effacer des données plus récentes que la sauvegarde.
 */
export async function POST(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const tables = body?.tables;

  if (!tables || typeof tables !== "object") {
    return NextResponse.json(
      { error: "Fichier invalide : la clé « tables » est manquante." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const restored: Record<string, number> = {};

  for (const tableName of RESTORE_ORDER) {
    const rows = tables[tableName];
    if (!Array.isArray(rows) || rows.length === 0) {
      restored[tableName] = 0;
      continue;
    }

    let count = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: "id" });
      if (error) {
        return NextResponse.json(
          {
            error: `Erreur en restaurant « ${tableName} » : ${error.message}`,
            restoredSoFar: restored,
          },
          { status: 500 }
        );
      }
      count += chunk.length;
    }
    restored[tableName] = count;
  }

  const totalRows = Object.values(restored).reduce((sum, n) => sum + n, 0);
  await logAdminActivity(
    "data_restored",
    `Sauvegarde restaurée : ${totalRows} ligne(s) au total`,
    restored
  );

  return NextResponse.json({ ok: true, restored });
}
