import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notExpiredClause } from "@/lib/quiz-availability";

export const dynamic = "force-dynamic";

// Plusieurs quiz peuvent être actifs en même temps (quiz du jour + quiz
// hebdomadaire, ou plusieurs quotidiens) : on renvoie la liste complète,
// triée par création la plus récente, pour que l'appelant choisisse. Un
// quiz dont l'échéance est passée n'est plus proposé ici.
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, subtitle, category")
    .eq("is_active", true)
    .or(notExpiredClause())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ quizzes: data ?? [] });
}
