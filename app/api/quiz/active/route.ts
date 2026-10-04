import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Plusieurs quiz peuvent être actifs en même temps (quiz du jour + quiz
// hebdomadaire, ou plusieurs quotidiens) : on renvoie la liste complète,
// triée par date la plus récente, pour que l'appelant choisisse.
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date, category")
    .eq("is_active", true)
    .order("lesson_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ quizzes: data ?? [] });
}
