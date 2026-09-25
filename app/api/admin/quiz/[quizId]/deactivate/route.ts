import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdminRequestAuthenticated, isSameOriginRequest } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Requête refusée (origine invalide)" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("daily_quizzes")
    .update({ is_active: false })
    .eq("id", params.quizId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminActivity("quiz_deactivated", `Quiz désactivé : ${data.title}`, { quizId: data.id });

  return NextResponse.json({ quiz: data });
}
