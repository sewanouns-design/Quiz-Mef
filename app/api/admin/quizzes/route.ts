import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error, status, statusText } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date, is_active, created_at")
    .order("lesson_date", { ascending: false });

  console.log(
    `[DEBUG quizzes] url=${process.env.SUPABASE_URL} rows=${data?.length ?? "null"} status=${status} statusText=${statusText} error=${error ? JSON.stringify(error) : "none"}`
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ quizzes: data ?? [] });
}
